/**
 * Agent 工具命令
 *
 * 提供给 AI Agent 工具调用的 Tauri 命令
 */

use russh::client;
use russh::ChannelMsg;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri::Window;
use tauri_plugin_keyring::KeyringExt;
use tokio::sync::oneshot;

use crate::events::{OutputType, PASSWORD_CHANNEL_MANAGER, SudoPasswordRequestEvent, ToolOutputEvent};
use crate::ssh::{auth_with_key, AuthResult};

/// SSH 客户端处理器
struct ToolClientHandler;

impl client::Handler for ToolClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        // 自动接受服务器密钥（生产环境应该验证）
        Ok(true)
    }
}

// ==================== PTY 流式执行 ====================

/// 停止条件
#[derive(Debug, Clone)]
pub struct StopConditions {
    pub stop_on_success: Option<String>,
    pub stop_on_error: Option<String>,
}

/// 停止原因
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StopReason {
    Success,
    Error,
}

/// 流式命令执行结果（扩展版）
#[derive(Debug, Serialize, Deserialize)]
pub struct StreamingCommandResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub stopped_by: Option<StopReason>,
    pub error: Option<String>,
    pub timed_out: bool,
}

/// 检测是否为 sudo 密码提示（多语言支持）
fn is_sudo_password_prompt(output: &str) -> bool {
    let lower = output.to_lowercase();

    let prompt_patterns = [
        // 英文
        "[sudo] password for",
        "password for",
        "[sudo] password:",
        "password:",
        // 中文
        "密码",
        "请输入密码",
        // 德文
        "passwort",
        "passwort für",
        // 其他
        "enter password",
    ];

    prompt_patterns.iter().any(|&p| lower.contains(p))
}

/// 检测是否匹配停止条件
fn matches_stop_conditions(output: &str, conditions: &StopConditions) -> Option<StopReason> {
    let lower = output.to_lowercase();

    if let Some(ref success) = conditions.stop_on_success {
        if success
            .split('|')
            .any(|p| lower.contains(&p.trim().to_lowercase()))
        {
            return Some(StopReason::Success);
        }
    }

    if let Some(ref error) = conditions.stop_on_error {
        if error.split('|').any(|p| lower.contains(&p.trim().to_lowercase())) {
            return Some(StopReason::Error);
        }
    }

    None
}

/// 检测是否为 sudo 密码错误（多语言支持）
fn is_sudo_password_error(output: &str) -> bool {
    let lower = output.to_lowercase();
    let error_patterns = [
        // 英文
        "sorry, try again",
        "incorrect password",
        "wrong password",
        "authentication failure",
        "permission denied",
        // 中文
        "密码错误",
        "密码不正确",
        "认证失败",
        // 德文
        "passwort falsch",
        "zugang verweigert",
        "authentifizierung fehlgeschlagen",
    ];
    error_patterns.iter().any(|&p| lower.contains(p))
}

/// PTY 流式执行命令（两阶段模式：阶段1接收数据到Eof，阶段2等待ExitStatus）
async fn execute_with_pty_streaming(
    app: AppHandle,
    window: Window,
    handle: client::Handle<ToolClientHandler>,
    session_id: String,
    host: String,
    username: String,
    command: String,
    stop_conditions: StopConditions,
    max_wait_time: Duration,
) -> Result<StreamingCommandResult, Box<dyn std::error::Error>> {
    let mut channel = handle.channel_open_session().await?;

    // 请求 PTY
    channel
        .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
        .await?;

    log::info!("[Tool] PTY requested, executing command: {}", command);

    // 执行命令
    channel.exec(true, command.as_str()).await?;

    // ==================== 阶段1：命令执行阶段 ====================
    // 持续接收数据直到收到 Eof，累计执行时间

    let mut full_output = String::new();
    let mut stderr_output = String::new();
    let mut exit_code = None;
    let mut stop_reason = None;
    let mut timed_out = false;
    let mut received_data = false;

    // 密码处理状态
    let mut password_receiver: Option<oneshot::Receiver<String>> = None;
    let mut waiting_for_password = false;
    let mut password_from_keychain = false;
    let mut just_used_keychain_password = false;
    let mut just_sent_password = false;
    let mut password_attempt_count = 0;
    let mut ignore_next_password_prompt = false;

    // 超时计算：最少 30 秒，如果模型指定了时间则 +300ms 缓冲
    let timeout_threshold = if max_wait_time.as_secs() >= 30 {
        max_wait_time + Duration::from_millis(300)
    } else {
        Duration::from_secs(30)
    };

    let start_time = std::time::Instant::now();

    // 事件发送辅助函数
    let emit_output = |output_type: OutputType, data: &str| {
        let _ = window.emit(
            &format!("tool-output://{}", session_id),
            ToolOutputEvent {
                session_id: session_id.clone(),
                output_type,
                data: data.to_string(),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            },
        );
    };

    // 阶段1循环：接收数据直到 Eof
    loop {
        // 计算剩余超时时间
        let remaining_timeout = if waiting_for_password {
            // 等待密码时不限制超时
            Duration::from_secs(u64::MAX)
        } else {
            let elapsed = start_time.elapsed();
            if elapsed >= timeout_threshold {
                log::warn!("[Tool] Phase1 timeout after {:?}", elapsed);
                timed_out = true;
                break;
            }
            timeout_threshold.saturating_sub(elapsed)
        };

        tokio::select! {
            // 处理密码输入
            result = async {
                if let Some(ref mut rx) = password_receiver {
                    rx.await
                } else {
                    std::future::pending().await
                }
            } => {
                if let Ok(password) = result {
                    if password.is_empty() {
                        log::info!("[Tool] User cancelled password input");
                        return Ok(StreamingCommandResult {
                            success: false,
                            exit_code: None,
                            stdout: Some(full_output),
                            stderr: Some(stderr_output),
                            stopped_by: None,
                            error: Some("User cancelled sudo password input".to_string()),
                            timed_out: false,
                        });
                    }
                    password_attempt_count += 1;
                    log::info!("[Tool] Sending password (attempt {})", password_attempt_count);
                    let password_input = format!("{}\n", password);
                    let mut password_bytes = password_input.into_bytes();
                    channel.data(&mut Cursor::new(&password_bytes)).await?;
                    zeroize::Zeroize::zeroize(&mut password_bytes);
                    password_receiver = None;
                    waiting_for_password = false;
                    just_used_keychain_password = false;
                    just_sent_password = true;
                }
            }

            // 接收 channel 消息（带超时控制）
            msg = async {
                tokio::time::timeout(remaining_timeout, channel.wait()).await
            } => {
                let msg = match msg {
                    Ok(Some(m)) => m,
                    Ok(None) => {
                        log::info!("[Tool] Channel closed");
                        break;
                    }
                    Err(_) => {
                        // tokio::timeout::Elapsed
                        let elapsed = start_time.elapsed();
                        log::warn!("[Tool] Phase1 timeout after {:?}", elapsed);
                        timed_out = true;
                        break;
                    }
                };

                match msg {
                    ChannelMsg::Data { data } => {
                        let output = String::from_utf8_lossy(&data);
                        full_output.push_str(&output);
                        received_data = true;
                        emit_output(OutputType::Stdout, &output);

                        // 处理密码提示
                        if !waiting_for_password && password_receiver.is_none() && is_sudo_password_prompt(&output) {
                            if ignore_next_password_prompt {
                                log::info!("[Tool] Ignoring password prompt after error");
                                ignore_next_password_prompt = false;
                                just_sent_password = false;
                                continue;
                            }
                            if just_sent_password {
                                log::info!("[Tool] Password prompt after sending, waiting");
                                just_sent_password = false;
                                continue;
                            }
                            if password_attempt_count >= 3 {
                                log::error!("[Tool] Max password attempts reached");
                                break;
                            }
                            // 尝试 keychain
                            if let Some(saved_password) = get_sudo_password_from_keychain(&app, &host, &username).await {
                                log::info!("[Tool] Using password from keychain");
                                password_from_keychain = true;
                                just_used_keychain_password = true;
                                password_attempt_count += 1;
                                just_sent_password = true;
                                let password_input = format!("{}\n", saved_password);
                                let mut password_bytes = password_input.into_bytes();
                                let _ = channel.data(&mut Cursor::new(&password_bytes)).await;
                                zeroize::Zeroize::zeroize(&mut password_bytes);
                                continue;
                            }
                            // 需要用户输入
                            log::info!("[Tool] Requesting password from user");
                            let (tx, rx) = oneshot::channel();
                            password_receiver = Some(rx);
                            waiting_for_password = true;
                            let session_id_clone = session_id.clone();
                            tokio::spawn(async move {
                                PASSWORD_CHANNEL_MANAGER.register_channel(session_id_clone, tx).await;
                            });
                            let event = SudoPasswordRequestEvent {
                                session_id: session_id.clone(),
                                host: host.clone(),
                                username: username.clone(),
                                command: command.clone(),
                                prompt_text: output.to_string(),
                                can_save: true,
                            };
                            let _ = app.emit("sudo-password-request", event);
                            continue;
                        }

                        // 处理密码错误
                        if is_sudo_password_error(&output) {
                            if just_used_keychain_password {
                                log::warn!("[Tool] Keychain password failed");
                                remove_sudo_password_from_keychain(&app, &host, &username).await;
                                password_from_keychain = false;
                                just_used_keychain_password = false;
                                just_sent_password = false;
                                ignore_next_password_prompt = true;
                            } else if just_sent_password && !password_from_keychain {
                                log::warn!("[Tool] User password failed, retrying");
                                just_sent_password = false;
                            }
                            if password_attempt_count >= 3 {
                                log::error!("[Tool] Max password attempts reached");
                                break;
                            }
                            let (tx, rx) = oneshot::channel();
                            password_receiver = Some(rx);
                            waiting_for_password = true;
                            let session_id_clone = session_id.clone();
                            tokio::spawn(async move {
                                PASSWORD_CHANNEL_MANAGER.register_channel(session_id_clone, tx).await;
                            });
                            let event = SudoPasswordRequestEvent {
                                session_id: session_id.clone(),
                                host: host.clone(),
                                username: username.clone(),
                                command: command.clone(),
                                prompt_text: output.to_string(),
                                can_save: true,
                            };
                            let _ = app.emit("sudo-password-request", event);
                            continue;
                        }

                        // 密码成功
                        if just_sent_password && !is_sudo_password_error(&output) && !is_sudo_password_prompt(&output) {
                            log::info!("[Tool] Password accepted");
                            just_sent_password = false;
                        }

                        // 检测停止条件
                        if stop_reason.is_none() {
                            if let Some(reason) = matches_stop_conditions(&output, &stop_conditions) {
                                log::info!("[Tool] Stop condition matched: {:?}", reason);
                                stop_reason = Some(reason);
                                break;
                            }
                        }
                    }
                    ChannelMsg::ExtendedData { data, ext } => {
                        if ext == 1 {
                            let output = String::from_utf8_lossy(&data);
                            stderr_output.push_str(&output);
                            received_data = true;
                            emit_output(OutputType::Stderr, &output);
                        }
                    }
                    ChannelMsg::ExitStatus { exit_status } => {
                        exit_code = Some(exit_status as i32);
                        log::info!("[Tool] ExitStatus received: {}", exit_status);
                    }
                    ChannelMsg::Eof => {
                        log::info!("[Tool] Eof received, ending Phase1");
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    // ==================== 阶段2：等待 ExitStatus ====================
    // 收到 Eof 后，最多再等待 2 秒让 ExitStatus 到达
    if exit_code.is_none() && !timed_out {
        log::info!("[Tool] Phase2: waiting for ExitStatus (max 2s)");
        let phase2_deadline = std::time::Instant::now() + Duration::from_secs(2);

        while exit_code.is_none() && std::time::Instant::now() < phase2_deadline {
            match channel.wait().await {
                Some(ChannelMsg::ExitStatus { exit_status }) => {
                    exit_code = Some(exit_status as i32);
                    log::info!("[Tool] Phase2 ExitStatus received: {}", exit_status);
                }
                Some(ChannelMsg::Eof) | None => break,
                Some(_) => {}
            }
        }
    }

    // ==================== 结果判断 ====================
    let success = if timed_out {
        false
    } else if let Some(code) = exit_code {
        code == 0
    } else if received_data {
        true
    } else {
        false
    };

    Ok(StreamingCommandResult {
        success,
        exit_code,
        stdout: Some(full_output),
        stderr: Some(stderr_output),
        stopped_by: stop_reason,
        error: if timed_out {
            Some(format!("Command timed out after {:?}", max_wait_time))
        } else {
            None
        },
        timed_out,
    })
}

// ==================== Tool 执行命令配置 ====================

/// Tool 执行命令的 SSH 连接配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecuteConfig {
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

/// 执行命令（PTY 流式模式，支持条件自动停止和 sudo 密码输入）
#[tauri::command]
pub async fn tool_execute_command(
    app: AppHandle,
    window: Window,
    session_id: String,
    config: ToolExecuteConfig,
    command: String,
    stop_on_success: Option<String>,
    stop_on_error: Option<String>,
    max_wait_time: Option<u64>,
) -> Result<StreamingCommandResult, String> {
    log::info!(
        "[Tool] Execute START: {} on {}:{} (success: {:?}, error: {:?})",
        command, config.host, config.port, stop_on_success, stop_on_error
    );

    let timeout_duration = Duration::from_secs(max_wait_time.unwrap_or(30));

    // 建立连接
    let ssh_config = Arc::new(client::Config {
        inactivity_timeout: None,
        ..<_>::default()
    });

    log::info!("[Tool] Connecting to {}:{}...", config.host, config.port);
    let mut handle = match client::connect(ssh_config, (config.host.as_str(), config.port), ToolClientHandler).await {
        Ok(h) => {
            log::info!("[Tool] Connection established");
            h
        }
        Err(e) => {
            let msg = format!("Connection failed: {}", e);
            log::error!("[Tool] {}", msg);
            return Err(msg);
        }
    };

    // 认证流程：优先使用密钥认证
    let auth_success = if let Some(key_path) = &config.private_key_path {
        // 使用私钥认证
        let passphrase = config.key_passphrase.as_deref();
        match auth_with_key(&mut handle, &config.username, key_path, passphrase).await {
            Ok(AuthResult::Success) => true,
            Ok(AuthResult::NeedPassphrase(_)) => {
                return Err("Key passphrase required but not provided".to_string());
            }
            Ok(AuthResult::Failed(msg)) => {
                log::warn!("[Tool] Key auth failed: {}", msg);
                false
            }
            Err(e) => {
                log::warn!("[Tool] Key auth error: {}", e);
                false
            }
        }
    } else if let Some(pwd) = &config.password {
        // 使用密码认证
        match handle.authenticate_password(config.username.clone(), pwd).await {
            Ok(r) => r.success(),
            Err(e) => {
                let msg = format!("Password auth failed: {}", e);
                log::error!("[Tool] {}", msg);
                return Err(msg);
            }
        }
    } else {
        return Err("No authentication credentials provided".to_string());
    };

    if !auth_success {
        log::error!("[Tool] Authentication failed");
        return Err("Authentication failed".to_string());
    }

    log::info!("[Tool] SSH connection and authentication successful");

    // 执行命令
    let stop_conditions = StopConditions {
        stop_on_success,
        stop_on_error,
    };

    log::info!("[Tool] Calling execute_with_pty_streaming...");
    match execute_with_pty_streaming(
        app,
        window,
        handle,
        session_id,
        config.host.clone(),
        config.username.clone(),
        command,
        stop_conditions,
        timeout_duration,
    )
    .await
    {
        Ok(result) => {
            log::info!(
                "[Tool] Command completed: success={}, exit_code={:?}",
                                result.success,
                                result.exit_code
            );
            Ok(result)
        }
        Err(e) => {
            let msg = format!("Command execution failed: {}", e);
            log::error!("[Tool] {}", msg);
            Err(msg)
        }
    }
}

// ==================== Sudo 密码 Keychain 辅助函数 ====================

/// Sudo 密码 keychain 服务名称格式
fn sudo_password_service(host: &str, username: &str) -> String {
    format!("sudo:{}@{}", username, host)
}

/// 密码及时间戳组合格式
fn format_password_with_timestamp(password: &str, timestamp: i64) -> String {
    format!("{}|{}", password, timestamp)
}

/// 从密码组合中解析出实际密码和时间戳
fn parse_password_with_timestamp(combined: &str) -> Option<(String, i64)> {
    let mut parts = combined.rsplitn(2, '|');
    let timestamp_str = parts.next()?.parse::<i64>().ok()?;
    let password = parts.next()?.to_string();
    Some((password, timestamp_str))
}

/// 从 keychain 获取 sudo 密码（带过期检查）
async fn get_sudo_password_from_keychain(
    app: &AppHandle,
    host: &str,
    username: &str,
) -> Option<String> {
    let service = sudo_password_service(host, username);
    match app.keyring().get_password(&service, "sudo_password") {
        Ok(Some(combined)) => {
            if let Some((password, timestamp)) = parse_password_with_timestamp(&combined) {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                let elapsed = now - timestamp;

                // 检查是否超过1小时（3600秒）
                if elapsed > 3600 {
                    log::info!("[Tool] Saved password expired ({} seconds old), removing", elapsed);
                    let _ = app.keyring().delete_password(&service, "sudo_password");
                    return None;
                }

                log::info!("[Tool] Sudo password found in keychain for {}, age: {} seconds", service, elapsed);
                Some(password)
            } else {
                // 兼容旧格式：如果没有时间戳，说明是旧版本保存的密码，直接使用
                log::info!("[Tool] Legacy password format found in keychain for {}", service);
                Some(combined)
            }
        }
        _ => {
            log::info!("[Tool] No sudo password in keychain for {}", service);
            None
        }
    }
}

/// 保存 sudo 密码到 keychain（带时间戳）
async fn save_sudo_password_to_keychain(
    app: &AppHandle,
    host: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let service = sudo_password_service(host, username);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let combined = format_password_with_timestamp(password, now);

    app.keyring()
        .set_password(&service, "sudo_password", &combined)
        .map_err(|e| format!("Failed to save password to keychain: {}", e))?;
    log::info!("[Tool] Sudo password with timestamp saved to keychain for {}", service);
    Ok(())
}

/// 从 keychain 移除 sudo 密码（用于密码错误时清除）
async fn remove_sudo_password_from_keychain(
    app: &AppHandle,
    host: &str,
    username: &str,
) {
    let service = sudo_password_service(host, username);
    let _ = app.keyring().delete_password(&service, "sudo_password");
    log::info!("[Tool] Sudo password removed from keychain for {}", service);
}

/// 提交 sudo 密码命令
#[tauri::command]
pub async fn submit_sudo_password(
    app: AppHandle,
    session_id: String,
    password: String,
    save_to_keychain: bool,
    host: String,
    username: String,
) -> Result<(), String> {
    log::info!("[Tool] Password submitted for session: {}, save_to_keychain: {}", session_id, save_to_keychain);

    // 如果用户选择保存，直接保存到 keychain（使用专门的 sudo 服务名称）
    if save_to_keychain {
        log::info!("[Tool] Saving password to keychain for sudo:{}@{}", username, host);
        save_sudo_password_to_keychain(&app, &host, &username, &password).await?;
    }

    // 发送密码到等待的 PTY 执行
    PASSWORD_CHANNEL_MANAGER
        .send_password(&session_id, password)
        .await
        .map_err(|e| format!("Failed to submit password: {}", e))
}

/// 取消 sudo 密码输入命令
#[tauri::command]
pub async fn cancel_sudo_password(session_id: String) -> Result<(), String> {
    log::info!("[Tool] Password cancelled for session: {}", session_id);

    // 发送取消信号到等待的 PTY 执行
    PASSWORD_CHANNEL_MANAGER
        .cancel_password(&session_id)
        .await
        .map_err(|e| format!("Failed to cancel password: {}", e))
}
