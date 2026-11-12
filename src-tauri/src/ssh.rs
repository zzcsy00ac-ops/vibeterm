/**
 * SSH 客户端模块
 *
 * 使用 Russh 库实现 SSH 连接和会话管理
 */

use russh::client;
use russh::keys::*;
use russh::ChannelMsg;
use russh::Disconnect;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, State, Window};
use tokio::sync::mpsc;

/// SSH 会话信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHSessionInfo {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub status: String,
}

/// SSH 连接配置
#[derive(Debug, Clone, Deserialize)]
pub struct SSHConnectConfig {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub key_passphrase: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

/// 认证结果
pub enum AuthResult {
    Success,
    NeedPassphrase(String),
    Failed(String),
}

/// 私钥认证（公开函数，供 Monitor 和 SFTP 模块使用）
/// 泛型版本，支持任何实现了 Handler trait 的类型
pub async fn auth_with_key<H>(
    handle: &mut client::Handle<H>,
    username: &str,
    key_path: &str,
    passphrase: Option<&str>,
) -> Result<AuthResult, Box<dyn std::error::Error>>
where
    H: russh::client::Handler<Error = russh::Error> + Send + 'static,
{
    use russh::keys::*;

    log::info!("[auth_with_key] Called with:");
    log::info!("  username: {}", username);
    log::info!("  key_path: {}", key_path);
    log::info!("  passphrase: {:?}", passphrase);

    // 处理空值：哨兵值 "<none>" 或空字符串都表示没有密码短语
    let actual_passphrase = match passphrase {
        Some(p) if p == "<none>" || p.is_empty() => None,
        _ => passphrase,
    };

    log::info!("[auth_with_key] actual_passphrase after processing: {:?}", actual_passphrase);

    // 加载私钥（使用 russh::keys 内置模块）
    let key = match load_secret_key(key_path, actual_passphrase) {
        Ok(k) => k,
        Err(e) => {
            // 检查是否是密码短语错误
            let error_msg = e.to_string().to_lowercase();
            if error_msg.contains("passphrase")
                || error_msg.contains("password")
                || error_msg.contains("encrypted") {
                return Ok(AuthResult::NeedPassphrase(key_path.to_string()));
            }
            return Ok(AuthResult::Failed(format!("Failed to load key: {}", e)));
        }
    };

    // 使用 PrivateKeyWithHashAlg 包装密钥
    let key_with_hash = PrivateKeyWithHashAlg::new(
        Arc::new(key),
        handle.best_supported_rsa_hash().await?.flatten(),
    );

    // 公钥认证
    let auth_result = handle
        .authenticate_publickey(username, key_with_hash)
        .await
        .map_err(|e| format!("Auth failed: {}", e))?;

    if auth_result.success() {
        Ok(AuthResult::Success)
    } else {
        Ok(AuthResult::Failed("Public key auth rejected".to_string()))
    }
}

/// SSH 会话命令
pub enum SSHCommand {
    Write(Vec<u8>),
    Resize(u16, u16), // (cols, rows)
    Close,
}

/// 会话响应发送器
type SessionResponder = mpsc::Sender<Result<(), String>>;

/// 全局会话存储
pub type SessionStore = Arc<tokio::sync::Mutex<HashMap<String, mpsc::Sender<(SSHCommand, Option<SessionResponder>)>>>>;

/// SSH 客户端处理器
struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/// 运行 SSH 会话
async fn run_ssh_session(
    window: Window,
    session_id: String,
    config: SSHConnectConfig,
    handle: client::Handle<ClientHandler>,
    mut command_rx: mpsc::Receiver<(SSHCommand, Option<SessionResponder>)>,
) {
    // 打开通道
    let mut channel = match handle.channel_open_session().await {
        Ok(ch) => ch,
        Err(e) => {
            log::error!("[SSH Session {}] Failed to open channel: {}", session_id, e);
            let _ = window.emit(&format!("ssh://error/{}", session_id), format!("Failed to open channel: {}", e));
            return;
        }
    };

    // 请求 PTY
    if let Err(e) = channel
        .request_pty(
            false,
            "xterm-256color",
            config.cols as u32,
            config.rows as u32,
            0,
            0,
            &[],
        )
        .await
    {
        log::error!("[SSH Session {}] Failed to request PTY: {}", session_id, e);
        let _ = window.emit(&format!("ssh://error/{}", session_id), format!("Failed to request PTY: {}", e));
        return;
    }

    // 请求 shell
    if let Err(e) = channel.request_shell(true).await {
        log::error!("[SSH Session {}] Failed to request shell: {}", session_id, e);
        let _ = window.emit(&format!("ssh://error/{}", session_id), format!("Failed to request shell: {}", e));
        return;
    }

    // 发送连接成功事件
    let _ = window.emit(&format!("ssh://connected/{}", session_id), ());

    // 主事件循环
    loop {
        tokio::select! {
            cmd = command_rx.recv() => {
                match cmd {
                    Some((SSHCommand::Write(data), resp)) => {
                        let mut cursor = Cursor::new(data);
                        match channel.data(&mut cursor).await {
                            Ok(_) => {
                                if let Some(r) = resp {
                                    let _ = r.send(Ok(()));
                                }
                            }
                            Err(e) => {
                                log::error!("[SSH {}] Write failed: {}", session_id, e);
                                if let Some(r) = resp {
                                    let _ = r.send(Err(format!("Failed to write: {}", e)));
                                }
                                break;
                            }
                        }
                    }
                    Some((SSHCommand::Resize(cols, rows), resp)) => {
                        let result = channel.window_change(cols as u32, rows as u32, 0, 0).await;
                        if let Err(e) = result {
                            log::error!("[SSH {}] Resize failed: {}", session_id, e);
                            if let Some(r) = resp {
                                let _ = r.send(Err(format!("Failed to resize: {}", e)));
                            }
                        } else if let Some(r) = resp {
                            let _ = r.send(Ok(()));
                        }
                    }
                    Some((SSHCommand::Close, resp)) => {
                        let _ = channel.eof().await;
                        if let Some(r) = resp {
                            let _ = r.send(Ok(()));
                        }
                        break;
                    }
                    None => {
                        log::warn!("[SSH {}] Command channel closed", session_id);
                        break;
                    }
                }
            }
            msg = channel.wait() => {
                match msg {
                    Some(ChannelMsg::Data { data }) => {
                        if let Ok(data_str) = std::str::from_utf8(&data) {
                            let _ = window.emit(&format!("ssh://data/{}", session_id), data_str);
                        }
                    }
                    Some(ChannelMsg::ExitStatus { exit_status }) => {
                        log::info!("[SSH {}] Shell exited: {:?}", session_id, exit_status);
                        let _ = window.emit(&format!("ssh://closed/{}", session_id), ());
                        break;
                    }
                    None => {
                        log::warn!("[SSH {}] Connection closed by server", session_id);
                        break;
                    }
                    Some(_) => {}
                }
            }
        }
    }

    log::info!("[SSH {}] Session ended", session_id);

    // 断开连接
    let _ = handle
        .disconnect(Disconnect::ByApplication, "", "English")
        .await;
}

/// 连接到 SSH 服务器
#[tauri::command]
pub async fn ssh_connect(
    store: State<'_, SessionStore>,
    window: Window,
    config: SSHConnectConfig,
) -> Result<String, String> {
    let session_id = config.session_id.clone();
    let session_id_clone = session_id.clone();

    // 检查会话是否已存在
    {
        let sessions = store.lock().await;
        if sessions.contains_key(&session_id) {
            return Err(format!("Session {} already exists", session_id));
        }
    }

    // 创建 SSH 配置
    // 启用 keepalive：每 60 秒检查一次连接活跃状态
    // 如果服务器在超时时间内没有响应，连接将自动关闭
    let ssh_config = Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(60)),
        ..<_>::default()
    });

    // 建立连接
    let mut handle = match client::connect(
        ssh_config,
        (config.host.as_str(), config.port),
        ClientHandler,
    )
    .await
    {
        Ok(h) => h,
        Err(e) => {
            let _ = window.emit(&format!("ssh://error/{}", session_id), format!("Connection failed: {}", e));
            return Err(format!("Connection failed: {}", e));
        }
    };

    // 认证流程
    let auth_success = if let Some(key_path) = &config.private_key_path {
        // 优先使用私钥认证
        match auth_with_key(
            &mut handle,
            &config.username,
            key_path,
            config.key_passphrase.as_deref()
        ).await {
            Ok(AuthResult::Success) => true,
            Ok(AuthResult::NeedPassphrase(path)) => {
                // 发送需要密码短语事件
                let _ = window.emit(
                    &format!("ssh://need_passphrase/{}", config.session_id),
                    path
                );
                return Err("Key passphrase required".to_string());
            }
            Ok(AuthResult::Failed(msg)) => {
                log::error!("[SSH {}] Key auth failed: {}", config.session_id, msg);
                false
            }
            Err(e) => {
                log::error!("[SSH {}] Key auth error: {}", config.session_id, e);
                false
            }
        }
    } else if let Some(password) = &config.password {
        // 使用密码认证
        match handle.authenticate_password(config.username.clone(), password).await {
            Ok(result) if result.success() => true,
            _ => {
                log::error!("[SSH {}] Password auth failed", config.session_id);
                false
            }
        }
    } else {
        let _ = window.emit(
            &format!("ssh://error/{}", config.session_id),
            "No credentials provided"
        );
        return Err("No credentials provided".to_string());
    };

    if !auth_success {
        let _ = window.emit(
            &format!("ssh://error/{}", config.session_id),
            "Authentication failed"
        );
        return Err("Authentication failed".to_string());
    }

    // 创建命令通道
    let (command_tx, command_rx) = mpsc::channel(32);

    // 启动会话任务
    let window_clone = window.clone();
    let config_clone = config.clone();
    tokio::spawn(async move {
        run_ssh_session(window_clone, session_id_clone, config_clone, handle, command_rx).await;
    });

    // 存储命令发送器
    {
        let mut sessions = store.lock().await;
        sessions.insert(session_id.clone(), command_tx);
    }

    Ok(session_id)
}

/// 向 SSH 会话写入数据
#[tauri::command]
pub async fn ssh_write(
    store: State<'_, SessionStore>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = store.lock().await;
    let tx = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let (resp_tx, mut resp_rx) = mpsc::channel(1);
    tx.send((SSHCommand::Write(data.into_bytes()), Some(resp_tx)))
        .await
        .map_err(|e| format!("Failed to send command: {}", e))?;

    resp_rx
        .recv()
        .await
        .ok_or_else(|| "Operation cancelled".to_string())?
}

/// 调整 SSH 会话的终端尺寸
#[tauri::command]
pub async fn ssh_resize(
    store: State<'_, SessionStore>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = store.lock().await;
    let tx = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let (resp_tx, mut resp_rx) = mpsc::channel(1);
    tx.send((SSHCommand::Resize(cols, rows), Some(resp_tx)))
        .await
        .map_err(|e| format!("Failed to send resize command: {}", e))?;

    resp_rx
        .recv()
        .await
        .ok_or_else(|| "Operation cancelled".to_string())?
}

/// 关闭 SSH 会话
#[tauri::command]
pub async fn ssh_close(
    store: State<'_, SessionStore>,
    window: Window,
    session_id: String,
) -> Result<(), String> {
    // 移除并获取会话发送器
    let tx = {
        let mut sessions = store.lock().await;
        sessions.remove(&session_id)
    };

    if let Some(tx) = tx {
        let _ = tx.send((SSHCommand::Close, None)).await;
    }

    // 发送关闭事件
    window
        .emit(&format!("ssh://closed/{}", session_id), ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取所有活动会话的信息
#[tauri::command]
pub async fn ssh_list_sessions(
    store: State<'_, SessionStore>,
) -> Result<Vec<SSHSessionInfo>, String> {
    let sessions = store.lock().await;
    let session_infos: Vec<SSHSessionInfo> = sessions
        .iter()
        .map(|(id, _)| SSHSessionInfo {
            session_id: id.clone(),
            host: "".to_string(),
            port: 0,
            username: "".to_string(),
            status: "connected".to_string(),
        })
        .collect();

    Ok(session_infos)
}

/// 初始化会话存储
pub fn init_session_store() -> SessionStore {
    Arc::new(tokio::sync::Mutex::new(HashMap::new()))
}

/// 获取私钥密码短语
#[tauri::command]
pub async fn ssh_get_key_passphrase(
    app: tauri::AppHandle,
    key_path: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_keyring::KeyringExt;

    let service = format!("ssh:key:{}", key_path);
    let username = &key_path;

    app.keyring()
        .get_password(&service, username)
        .map_err(|e| e.to_string())
}
