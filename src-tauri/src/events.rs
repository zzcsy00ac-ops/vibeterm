/**
 * Tauri 事件定义
 *
 * 用于 Rust 后端和前端之间的通信
 */

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

/// Sudo 密码请求事件
///
/// 当检测到 sudo 密码提示时，发送此事件到前端
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SudoPasswordRequestEvent {
    pub session_id: String,
    pub host: String,
    pub username: String,
    pub command: String,
    pub prompt_text: String,
    /// 是否显示"1小时内免提示"选项
    pub can_save: bool,
}

/// 密码提交事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SudoPasswordSubmitEvent {
    pub session_id: String,
    pub password: String,
}

/// 密码取消事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SudoPasswordCancelEvent {
    pub session_id: String,
}

/// 工具输出流事件
///
/// 流式发送命令输出到前端显示
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutputEvent {
    pub session_id: String,
    pub output_type: OutputType,
    pub data: String,
    pub timestamp: u64,
}

/// 输出类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OutputType {
    Stdout,
    Stderr,
    Success,
    Error,
}

/// 全局密码响应通道管理器
pub struct PasswordChannelManager {
    channels: Mutex<std::collections::HashMap<String, tokio::sync::oneshot::Sender<String>>>,
}

impl PasswordChannelManager {
    pub fn new() -> Self {
        Self {
            channels: Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// 注册密码响应通道
    pub async fn register_channel(
        &self,
        session_id: String,
        sender: tokio::sync::oneshot::Sender<String>,
    ) {
        let mut channels = self.channels.lock().await;
        channels.insert(session_id, sender);
    }

    /// 发送密码到通道
    pub async fn send_password(
        &self,
        session_id: &str,
        password: String,
    ) -> Result<(), String> {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.remove(session_id) {
            match sender.send(password) {
                Ok(()) => Ok(()),
                Err(_) => Err("Failed to send password".to_string()),
            }
        } else {
            Err("No password channel found".to_string())
        }
    }

    /// 取消密码输入（发送特殊标记表示取消）
    pub async fn cancel_password(
        &self,
        session_id: &str,
    ) -> Result<(), String> {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.remove(session_id) {
            // 发送空字符串表示取消
            match sender.send(String::new()) {
                Ok(()) => Ok(()),
                Err(_) => Err("Failed to cancel password".to_string()),
            }
        } else {
            Err("No password channel found".to_string())
        }
    }
}

/// 密码通道管理器全局实例
pub static PASSWORD_CHANNEL_MANAGER: once_cell::sync::Lazy<PasswordChannelManager> =
    once_cell::sync::Lazy::new(|| PasswordChannelManager::new());
