/**
 * SFTP 会话管理模块
 *
 * 使用 russh-sftp 实现 SFTP 子系统操作
 * SFTP 连接独立于 Shell 连接（避免 Handle 共享问题）
 */

use russh::client;
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

/// SFTP 文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SFTPFile {
    pub name: String,
    pub full_path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mode: u32,
    pub mtime: i64,
}

/// SFTP 连接配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SFTPConnectConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(rename = "privateKeyPath", skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(rename = "keyPassphrase", skip_serializing_if = "Option::is_none")]
    pub key_passphrase: Option<String>,
}

/// SSH 客户端处理器
struct SFTPClientHandler;

impl client::Handler for SFTPClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/// SFTP 会话包装器
pub struct SFTPSessionWrapper {
    pub sftp: SftpSession,
    // handle is kept to maintain the SSH connection
    #[allow(dead_code)]
    handle: client::Handle<SFTPClientHandler>,
}

/// 上传会话 - 用于取消正在进行的上传
#[derive(Clone)]
pub struct UploadSession {
    pub session_id: String,
    pub remote_path: String,
    pub cancel_tx: broadcast::Sender<()>,
}

/// SFTP 会话管理器
pub struct SFTPSessionManager {
    sessions: HashMap<String, SFTPSessionWrapper>,
    // 存储活跃的上传会话，key 格式: "session_id:remote_path"
    active_uploads: HashMap<String, UploadSession>,
}

impl SFTPSessionManager {
    /// 创建新的 SFTP 会话管理器
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            active_uploads: HashMap::new(),
        }
    }

    /// 注册上传会话并返回取消接收器
    pub fn register_upload(
        &mut self,
        session_id: String,
        remote_path: String,
    ) -> (UploadSession, broadcast::Receiver<()>) {
        let (cancel_tx, cancel_rx) = broadcast::channel(1);
        let upload_session = UploadSession {
            session_id: session_id.clone(),
            remote_path: remote_path.clone(),
            cancel_tx,
        };

        let key = format!("{}:{}", session_id, remote_path);
        self.active_uploads.insert(key, upload_session.clone());

        (upload_session, cancel_rx)
    }

    /// 取消上传
    pub fn cancel_upload(&mut self, session_id: String, remote_path: String) -> Result<(), String> {
        let key = format!("{}:{}", session_id, remote_path);

        if let Some(upload_session) = self.active_uploads.get(&key) {
            // 发送取消信号
            let _ = upload_session.cancel_tx.send(());
            Ok(())
        } else {
            Err(format!("Upload session not found: {}", key))
        }
    }

    /// 注销上传会话（上传完成或失败后调用）
    pub fn unregister_upload(&mut self, session_id: String, remote_path: String) {
        let key = format!("{}:{}", session_id, remote_path);
        self.active_uploads.remove(&key);
    }

    /// 创建 SSH 连接并返回 Handle
    async fn create_ssh_handle(
        config: &SFTPConnectConfig,
    ) -> Result<client::Handle<SFTPClientHandler>, String> {
        use crate::ssh::{auth_with_key, AuthResult};

        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: None,
            ..<_>::default()
        });

        let mut handle = client::connect(
            ssh_config,
            (config.host.as_str(), config.port),
            SFTPClientHandler,
        )
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

        // 认证流程：优先使用密钥认证
        let auth_success = if let Some(key_path) = &config.private_key_path {
            // 使用私钥认证
            match auth_with_key(&mut handle, &config.username, key_path, config.key_passphrase.as_deref()).await {
                Ok(AuthResult::Success) => true,
                Ok(AuthResult::NeedPassphrase(_)) => {
                    return Err("Key passphrase required".to_string());
                }
                Ok(AuthResult::Failed(msg)) => {
                    log::warn!("[SFTP] Key auth failed: {}", msg);
                    false
                }
                Err(e) => {
                    log::warn!("[SFTP] Key auth error: {}", e);
                    false
                }
            }
        } else if let Some(password) = &config.password {
            // 使用密码认证
            let auth_result = handle
                .authenticate_password(config.username.clone(), password)
                .await
                .map_err(|e| format!("Authentication error: {}", e))?;
            auth_result.success()
        } else {
            return Err("No credentials provided".to_string());
        };

        if !auth_success {
            return Err("Authentication failed".to_string());
        }

        Ok(handle)
    }

    /// 获取或创建 SFTP 会话
    /// 如果会话已存在但连接已断开，会重新创建连接
    pub async fn get_or_create_session(
        &mut self,
        session_id: &str,
        config: &SFTPConnectConfig,
    ) -> Result<&mut SFTPSessionWrapper, String> {
        // 如果会话已存在，先检查连接是否有效
        if self.sessions.contains_key(session_id) {
            // 尝试使用现有会话执行一个简单操作来验证连接
            // 如果连接已断开，这个操作会失败
            let needs_reconnect = if let Some(wrapper) = self.sessions.get(session_id) {
                // 尝试读取根目录来检测连接是否有效
                // 使用短超时避免长时间阻塞
                let test_result = tokio::time::timeout(
                    tokio::time::Duration::from_secs(1),
                    wrapper.sftp.read_dir("/")
                ).await;

                match test_result {
                    Ok(Ok(_)) => false, // 连接有效，不需要重连
                    _ => true, // 超时或错误，需要重连
                }
            } else {
                false
            };

            if needs_reconnect {
                // 连接已失效，删除旧会话
                self.sessions.remove(session_id);
            } else {
                // 连接有效，直接返回
                return Ok(self.sessions.get_mut(session_id).unwrap());
            }
        }

        // 创建新的 SSH 连接用于 SFTP
        let handle: client::Handle<SFTPClientHandler> =
            Self::create_ssh_handle(config).await?;

        // 打开 SFTP 子系统
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;

        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        self.sessions.insert(session_id.to_string(), SFTPSessionWrapper { sftp, handle });

        Ok(self.sessions.get_mut(session_id).unwrap())
    }

    /// 获取现有会话
    pub fn get_session(&mut self, session_id: &str) -> Option<&mut SFTPSessionWrapper> {
        self.sessions.get_mut(session_id)
    }

    /// 关闭 SFTP 会话
    pub async fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        self.sessions.remove(session_id);
        Ok(())
    }

    /// 检查会话是否存在
    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }
}

/// 初始化 SFTP 会话管理器
pub fn init_sftp_manager() -> Arc<Mutex<SFTPSessionManager>> {
    Arc::new(Mutex::new(SFTPSessionManager::new()))
}
