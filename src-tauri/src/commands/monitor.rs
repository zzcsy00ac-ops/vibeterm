//! 监控数据获取模块
//!
//! 通过 SSH 执行命令获取服务器监控数据
//! 使用 MonitorSessionManager 实现连接复用

use russh::client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use crate::ssh::{auth_with_key, AuthResult};

/// 服务器基础指标
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerMetrics {
    /// 运行时长（秒）
    #[serde(rename = "uptime")]
    pub uptime: u64,
    /// CPU 核心数
    #[serde(rename = "cpuCores")]
    pub cpu_cores: u32,
    /// 总内存（字节）
    #[serde(rename = "totalMemory")]
    pub total_memory: u64,
    /// 已用内存（字节）
    #[serde(rename = "usedMemory")]
    pub used_memory: u64,
    /// 剩余内存（字节）
    #[serde(rename = "freeMemory")]
    pub free_memory: u64,
    /// 总磁盘（字节）
    #[serde(rename = "totalDisk")]
    pub total_disk: u64,
    /// 已用磁盘（字节）
    #[serde(rename = "usedDisk")]
    pub used_disk: u64,
    /// 剩余磁盘（字节）
    #[serde(rename = "freeDisk")]
    pub free_disk: u64,
    /// 系统负载
    #[serde(rename = "loadAverage")]
    pub load_average: f64,
    /// 当前上传速率（字节/秒）- 由前端计算
    #[serde(rename = "currentUploadRate")]
    pub current_upload_rate: u64,
    /// 当前下载速率（字节/秒）- 由前端计算
    #[serde(rename = "currentDownloadRate")]
    pub current_download_rate: u64,
    /// 累计接收字节数（用于前端计算速率）
    #[serde(rename = "rxBytes")]
    pub rx_bytes: u64,
    /// 累计发送字节数（用于前端计算速率）
    #[serde(rename = "txBytes")]
    pub tx_bytes: u64,
}

/// 网络历史数据点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkHistoryPoint {
    #[serde(rename = "time")]
    pub time: u64,
    #[serde(rename = "uploadRate")]
    pub upload_rate: u64,
    #[serde(rename = "downloadRate")]
    pub download_rate: u64,
}

/// 进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub user: String,
    #[serde(rename = "cpuPercent")]
    pub cpu_percent: f64,
    #[serde(rename = "memoryPercent")]
    pub memory_percent: f64,
    #[serde(rename = "memoryMB")]
    pub memory_mb: f64,
}

/// 磁盘使用信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskUsage {
    #[serde(rename = "mountPoint")]
    pub mount_point: String,
    pub filesystem: String,
    #[serde(rename = "type")]
    pub fs_type: String,
    pub total: String,
    pub used: String,
    pub free: String,
    pub percent: f64,
    #[serde(rename = "totalBytes")]
    pub total_bytes: u64,
    #[serde(rename = "usedBytes")]
    pub used_bytes: u64,
    #[serde(rename = "freeBytes")]
    pub free_bytes: u64,
}

/// 网络连接统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkConnections {
    pub established: u32,
    pub closed: u32,
    pub orphaned: u32,
    #[serde(rename = "timeWait")]
    pub time_wait: u32,
}

/// 完整监控数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorData {
    pub metrics: ServerMetrics,
    pub history: Vec<NetworkHistoryPoint>,
    pub processes: Vec<ProcessInfo>,
    #[serde(rename = "diskUsage")]
    pub disk_usage: Vec<DiskUsage>,
    #[serde(rename = "networkConnections")]
    pub network_connections: NetworkConnections,
    #[serde(rename = "lastUpdated")]
    pub last_updated: u64,
}

/// Monitor 连接配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConnectConfig {
    #[serde(rename = "sessionId")]
    pub session_id: String,
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

/// SSH 客户端处理器（用于监控）
struct MonitorClientHandler;

impl client::Handler for MonitorClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/// 监控会话 - 持有 SSH 连接和状态
struct MonitorSession {
    /// SSH 连接句柄（使用 Arc 共享）
    handle: Arc<client::Handle<MonitorClientHandler>>,
    /// 主机地址
    host: String,
    /// 端口
    port: u16,
    /// 用户名
    username: String,
    /// 密码（可选，如果使用密钥认证则为空）
    password: Option<String>,
    /// 私钥路径（可选）
    private_key_path: Option<String>,
    /// 密钥密码短语（可选）
    key_passphrase: Option<String>,
    /// 会话 ID
    session_id: String,
    /// 最后活跃时间（用于清理过期会话）
    last_active: std::time::Instant,
}

impl MonitorSession {
    /// 检查连接是否仍然有效
    async fn is_connected(&self) -> bool {
        // 尝试执行一个简单命令来检测连接状态
        let result = ssh_exec_command(&self.handle, "echo ping").await;
        result.is_ok() && result.ok().map_or(false, |s| s.trim() == "ping")
    }

    /// 更新活跃时间
    fn update_active(&mut self) {
        self.last_active = std::time::Instant::now();
    }

    /// 获取空闲时长
    fn idle_duration(&self) -> std::time::Duration {
        self.last_active.elapsed()
    }
}

/// 监控会话管理器 - 全局单例
struct MonitorSessionManager {
    /// 会话映射表: session_id -> MonitorSession
    sessions: HashMap<String, MonitorSession>,
}

impl MonitorSessionManager {
    /// 创建新的管理器
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// 获取或创建会话
    async fn get_or_create_session(
        &mut self,
        session_id: String,
        host: String,
        port: u16,
        username: String,
        password: Option<String>,
        private_key_path: Option<String>,
        key_passphrase: Option<String>,
    ) -> Result<Arc<client::Handle<MonitorClientHandler>>, String> {
        // 检查是否已有会话
        if let Some(session) = self.sessions.get_mut(&session_id) {
            // 验证连接信息是否匹配
            if session.host == host && session.port == port && session.username == username {
                // 检查连接是否仍然有效
                if session.is_connected().await {
                    session.update_active();
                    log::debug!("[Monitor] Reusing existing session: {}", session_id);
                    return Ok(Arc::clone(&session.handle));
                } else {
                    // 连接已断开，移除旧会话
                    log::info!("[Monitor] Session disconnected, removing: {}", session_id);
                    self.remove_session(&session_id).await;
                }
            } else {
                // 会话信息不匹配，移除旧会话
                log::info!("[Monitor] Session info changed, removing: {}", session_id);
                self.remove_session(&session_id).await;
            }
        }

        // 创建新会话
        log::info!("[Monitor] Creating new session: {}@{}:{}", username, host, port);
        let handle = Self::create_ssh_connection(&host, port, &username, password.as_deref(), private_key_path.as_deref(), key_passphrase.as_deref()).await?;
        let handle_arc = Arc::new(handle);

        let new_session = MonitorSession {
            handle: Arc::clone(&handle_arc),
            host,
            port,
            username,
            password,
            private_key_path,
            key_passphrase,
            session_id: session_id.clone(),
            last_active: std::time::Instant::now(),
        };

        self.sessions.insert(session_id.clone(), new_session);
        Ok(handle_arc)
    }

    /// 创建 SSH 连接
    async fn create_ssh_connection(
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key_path: Option<&str>,
        key_passphrase: Option<&str>,
    ) -> Result<client::Handle<MonitorClientHandler>, String> {
        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(60)),
            ..<_>::default()
        });

        let mut handle = client::connect(ssh_config, (host, port), MonitorClientHandler)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        // 认证流程：优先使用密钥认证
        let auth_success = if let Some(key_path) = private_key_path {
            // 使用私钥认证
            match auth_with_key(&mut handle, username, key_path, key_passphrase).await {
                Ok(AuthResult::Success) => true,
                Ok(AuthResult::NeedPassphrase(_)) => {
                    return Err("Key passphrase required".to_string());
                }
                Ok(AuthResult::Failed(msg)) => {
                    log::warn!("[Monitor] Key auth failed: {}", msg);
                    false
                }
                Err(e) => {
                    log::warn!("[Monitor] Key auth error: {}", e);
                    false
                }
            }
        } else if let Some(pwd) = password {
            // 使用密码认证
            match handle.authenticate_password(username.to_string(), pwd).await {
                Ok(result) if result.success() => true,
                _ => false,
            }
        } else {
            return Err("No credentials provided".to_string());
        };

        if !auth_success {
            return Err("Authentication failed".to_string());
        }

        Ok(handle)
    }

    /// 移除会话
    async fn remove_session(&mut self, session_id: &str) {
        if let Some(session) = self.sessions.remove(session_id) {
            // 优雅断开连接
            let _ = session
                .handle
                .disconnect(russh::Disconnect::ByApplication, "", "English")
                .await;
            log::info!("[Monitor] Session removed: {}", session_id);
        }
    }

    /// 清理空闲会话（超过阈值时间未活动）
    pub async fn cleanup_idle_sessions(&mut self) {
        let timeout = std::time::Duration::from_secs(60); // 60 秒无活动即清理
        let now = std::time::Instant::now();

        let expired: Vec<String> = self
            .sessions
            .iter()
            .filter(|(_, s)| now.saturating_duration_since(s.last_active) > timeout)
            .map(|(id, _)| id.clone())
            .collect();

        for id in expired {
            log::info!("[Monitor] Cleaning up idle session: {}", id);
            self.remove_session(&id).await;
        }
    }
}

/// 全局会话管理器（使用 tokio Mutex 支持异步）
static MANAGER: once_cell::sync::Lazy<tokio::sync::Mutex<MonitorSessionManager>> =
    once_cell::sync::Lazy::new(|| tokio::sync::Mutex::new(MonitorSessionManager::new()));

/// 启动后台清理任务
///
/// 定期检查并清理空闲的监控会话，防止窗口异常关闭导致连接泄漏
/// 必须在 Tauri async runtime 中调用（使用 tauri::async_runtime::spawn）
pub async fn start_cleanup_task() {
    tauri::async_runtime::spawn(async move {
        loop {
            // 每 30 秒执行一次清理
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;

            let mut manager = MANAGER.lock().await;
            let session_count = manager.sessions.len();

            if session_count > 0 {
                manager.cleanup_idle_sessions().await;

                let after_count = manager.sessions.len();
                if after_count < session_count {
                    log::info!(
                        "[Monitor] Cleanup: removed {} idle session(s), {} active",
                        session_count - after_count,
                        after_count
                    );
                }
            }
        }
    });
    log::info!("[Monitor] Background cleanup task started");
}

/// 通过 SSH 执行命令并获取输出
async fn ssh_exec_command(
    handle: &client::Handle<MonitorClientHandler>,
    command: &str,
) -> Result<String, String> {
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel
        .exec(true, command)
        .await
        .map_err(|e| format!("Failed to exec command: {}", e))?;

    let mut output = String::new();

    loop {
        match channel.wait().await {
            Some(russh::ChannelMsg::Data { data }) => {
                if let Ok(s) = std::str::from_utf8(&data) {
                    output.push_str(s);
                }
            }
            Some(russh::ChannelMsg::ExitStatus { .. }) | None => break,
            _ => {}
        }
    }

    Ok(output)
}

/// 解析 uptime 输出（只返回运行秒数）
fn parse_uptime(output: &str) -> u64 {
    // /proc/uptime 格式: "1234567.89 1234567.89" (运行秒数 空格 空闲秒数)
    let trimmed = output.trim();
    if let Some(first_space) = trimmed.find(' ') {
        let first_part = &trimmed[..first_space];
        if let Ok(seconds) = first_part.parse::<f64>() {
            return seconds as u64;
        }
    }

    // 回退：尝试解析纯数字
    if let Ok(seconds) = trimmed.parse::<f64>() {
        return seconds as u64;
    }

    // 回退到解析 uptime 命令输出
    // 示例: " 10:25:32 up 81 days,  0:00,  2 users,  load average: 0.00, 0.01, 0.05"
    let mut uptime_seconds: u64 = 0;

    if let Some(up_idx) = output.find("up ") {
        let up_str = &output[up_idx + 3..];

        // 处理天数: "81 days" 或 "1 day"
        let rest = if let Some(days_end) = up_str.find(" day") {
            let days_part = &up_str[..days_end];
            if let Ok(days) = days_part.trim().parse::<u64>() {
                uptime_seconds += days * 86400;
            }
            up_str[days_end + 4..].trim()
        } else {
            up_str
        };

        // 处理时间部分: "0:00" 或 "12:30"
        if let Some(comma_idx) = rest.find(',') {
            let time_part = &rest[..comma_idx];
            if let Some(_colon_idx) = time_part.find(':') {
                let parts: Vec<&str> = time_part.split(':').collect();
                if parts.len() >= 2 {
                    if let Ok(hours) = parts[0].trim().parse::<u64>() {
                        uptime_seconds += hours * 3600;
                    }
                    if let Ok(mins) = parts[1].trim().parse::<u64>() {
                        uptime_seconds += mins * 60;
                    }
                }
            }
        }
    }

    uptime_seconds
}

/// 解析 load average 输出
fn parse_loadavg(output: &str) -> f64 {
    // /proc/loadavg 格式: "0.15 0.20 0.18 1/123 4567" (1分钟 5分钟 15分钟 平均值)
    let trimmed = output.trim();
    if let Some(first_space) = trimmed.find(' ') {
        let first_part = &trimmed[..first_space];
        if let Ok(load) = first_part.parse::<f64>() {
            return load;
        }
    }
    0.0
}

/// 解析 nproc 输出
fn parse_nproc(output: &str) -> u32 {
    // nproc 输出格式: "4"
    let trimmed = output.trim();
    if let Ok(cores) = trimmed.parse::<u32>() {
        cores
    } else {
        1 // 默认单核
    }
}

/// 解析 free -b 输出
fn parse_free(output: &str) -> (u64, u64, u64) {
    // 示例输出:
    //               total        used        free      shared  buff/cache   available
    // Mem:     16777216000  8589934592  4294967296   536870912  3891314112  7516192768
    let mut total: u64 = 0;
    let mut used: u64 = 0;
    let mut free: u64 = 0;

    for line in output.lines() {
        if line.starts_with("Mem:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                total = parts[1].parse().unwrap_or(0);
                used = parts[2].parse().unwrap_or(0);
                free = parts[3].parse().unwrap_or(0);
            }
            break;
        }
    }

    (total, used, free)
}

/// 解析 df 输出
fn parse_df(output: &str) -> Vec<DiskUsage> {
    let mut disks = Vec::new();

    log::debug!("[parse_df] Raw df output:\n{}", output);

    for line in output.lines().skip(1) {
        // 跳过标题行
        let parts: Vec<&str> = line.split_whitespace().collect();

        log::debug!("[parse_df] Line parts ({:?}): {:?}", parts.len(), parts);

        if parts.len() >= 6 {
            let filesystem = parts[0].to_string();
            let total_bytes: u64 = parts[1].parse().unwrap_or(0);
            let used_bytes: u64 = parts[2].parse().unwrap_or(0);
            let free_bytes: u64 = parts[3].parse().unwrap_or(0);
            let percent_str = parts[4].trim_end_matches('%');
            let percent: f64 = percent_str.parse().unwrap_or(0.0);
            let mount_point = parts[5].to_string();

            log::debug!("[parse_df] Parsed disk: {} - total: {}MB, used: {}MB, free: {}MB, percent: {}%, mount: {}",
                filesystem,
                total_bytes / (1024 * 1024),
                used_bytes / (1024 * 1024),
                free_bytes / (1024 * 1024),
                percent,
                mount_point
            );

            // 跳过一些特殊的文件系统
            if filesystem.starts_with("tmpfs")
                || filesystem.starts_with("devtmpfs")
                || filesystem == "none"
                || filesystem.starts_with("overlay")  // Docker overlay 文件系统（与基础分区重复）
                || filesystem.starts_with("docker")   // Docker 相关文件系统
                || mount_point.starts_with("/boot")
                || mount_point.starts_with("/snap")
                || mount_point.contains("/docker/")    // Docker 挂载点
                || mount_point.contains("/overlay2/")  // Docker overlay2 挂载点
            {
                log::debug!("[parse_df] Skipping filesystem: {} (mount: {})", filesystem, mount_point);
                continue;
            }

            disks.push(DiskUsage {
                mount_point,
                filesystem,
                fs_type: "".to_string(),
                total: format_bytes(total_bytes),
                used: format_bytes(used_bytes),
                free: format_bytes(free_bytes),
                percent,
                total_bytes,
                used_bytes,
                free_bytes,
            });
        }
    }

    log::debug!("[parse_df] Final disk count: {}", disks.len());
    disks
}

/// 解析 ps 输出获取进程列表
fn parse_ps(output: &str) -> Vec<ProcessInfo> {
    let mut processes = Vec::new();

    for line in output.lines().skip(1) {
        // 跳过标题行
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            let user = parts[0].to_string();
            let pid: u32 = parts[1].parse().unwrap_or(0);
            let cpu_percent: f64 = parts[2].parse().unwrap_or(0.0);
            let memory_percent: f64 = parts[3].parse().unwrap_or(0.0);
            let rss: f64 = parts[5].parse().unwrap_or(0.0); // RSS in KB
            let memory_mb = rss / 1024.0;
            let name = parts[10..].join(" ");

            processes.push(ProcessInfo {
                pid,
                name,
                user,
                cpu_percent,
                memory_percent,
                memory_mb,
            });
        }
    }

    processes
}

/// 解析 ss -s 输出
fn parse_ss(output: &str) -> NetworkConnections {
    let mut connections = NetworkConnections::default();

    for line in output.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains("estab") {
            // TCP:   10 (estab 5, closed 0, orphaned 0, timewait 0)
            if let Some(estab_idx) = line_lower.find("estab ") {
                let rest = &line[estab_idx + 6..];
                if let Some(comma_idx) = rest.find(',') {
                    if let Ok(n) = rest[..comma_idx].trim().parse::<u32>() {
                        connections.established = n;
                    }
                }
            }
            if let Some(closed_idx) = line_lower.find("closed ") {
                let rest = &line[closed_idx + 7..];
                if let Some(comma_idx) = rest.find(',') {
                    if let Ok(n) = rest[..comma_idx].trim().parse::<u32>() {
                        connections.closed = n;
                    }
                }
            }
            if let Some(orph_idx) = line_lower.find("orphaned ") {
                let rest = &line[orph_idx + 9..];
                if let Some(comma_idx) = rest.find(',') {
                    if let Ok(n) = rest[..comma_idx].trim().parse::<u32>() {
                        connections.orphaned = n;
                    }
                }
            }
            if let Some(tw_idx) = line_lower.find("timewait ") {
                let rest = &line[tw_idx + 9..];
                let end = rest.find(|c: char| !c.is_numeric()).unwrap_or(rest.len());
                if let Ok(n) = rest[..end].trim().parse::<u32>() {
                    connections.time_wait = n;
                }
            }
        }
    }

    connections
}

/// 解析网络流量
fn parse_network_stats(output: &str) -> (u64, u64) {
    // /proc/net/dev 格式
    let mut rx_bytes: u64 = 0;
    let mut tx_bytes: u64 = 0;

    for line in output.lines() {
        let line = line.trim();
        // 跳过 lo 接口和标题行
        if line.starts_with("lo:") || !line.contains(':') {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 10 {
            // 第 1 列是接收字节，第 9 列是发送字节
            let rx: u64 = parts[1].parse().unwrap_or(0);
            let tx: u64 = parts[9].parse().unwrap_or(0);
            rx_bytes += rx;
            tx_bytes += tx;
        }
    }

    (rx_bytes, tx_bytes)
}

/// 格式化字节数
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// 获取监控数据
#[tauri::command]
pub async fn get_monitor_data(
    config: MonitorConnectConfig,
) -> Result<MonitorData, String> {
    log::info!(
        "[Monitor] Getting data for {}@{}:{} (session: {})",
        config.username,
        config.host,
        config.port,
        config.session_id
    );

    // 获取或创建会话（使用连接复用）
    let handle = {
        let mut manager = MANAGER.lock().await;
        manager
            .get_or_create_session(
                config.session_id.clone(),
                config.host.clone(),
                config.port,
                config.username.clone(),
                config.password.clone(),
                config.private_key_path.clone(),
                config.key_passphrase.clone(),
            )
            .await?
    };

    // 执行监控命令
    let uptime_output = match ssh_exec_command(&handle, "cat /proc/uptime").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get uptime: {}", e);
            String::new()
        }
    };
    let loadavg_output = match ssh_exec_command(&handle, "cat /proc/loadavg").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get loadavg: {}", e);
            String::new()
        }
    };
    let nproc_output = match ssh_exec_command(&handle, "nproc").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get cpu cores: {}", e);
            String::new()
        }
    };
    let free_output = match ssh_exec_command(&handle, "free -b").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get memory info: {}", e);
            String::new()
        }
    };
    let df_output = match ssh_exec_command(&handle, "df -B1").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get disk info: {}", e);
            String::new()
        }
    };
    let ps_mem_output = match ssh_exec_command(&handle, "ps aux --sort=-rss | head -11").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get process info: {}", e);
            String::new()
        }
    };
    let ss_output = match ssh_exec_command(&handle, "ss -s").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get network connections: {}", e);
            String::new()
        }
    };
    let net_output = match ssh_exec_command(&handle, "cat /proc/net/dev").await {
        Ok(output) => output,
        Err(e) => {
            log::warn!("[Monitor] Failed to get network stats: {}", e);
            String::new()
        }
    };

    // 解析数据
    let uptime = parse_uptime(&uptime_output);
    let cpu_cores = parse_nproc(&nproc_output);
    let load_average = parse_loadavg(&loadavg_output);
    let (total_memory, used_memory, free_memory) = parse_free(&free_output);
    let disk_usage = parse_df(&df_output);
    let processes = parse_ps(&ps_mem_output);
    let network_connections = parse_ss(&ss_output);
    let (rx_bytes, tx_bytes) = parse_network_stats(&net_output);

    // 计算磁盘总量
    let (total_disk, used_disk, free_disk) =
        disk_usage
            .iter()
            .fold((0u64, 0u64, 0u64), |acc, d| {
                (
                    acc.0 + d.total_bytes,
                    acc.1 + d.used_bytes,
                    acc.2 + d.free_bytes,
                )
            });

    log::debug!("[Monitor] Aggregated disk stats: total: {}GB, used: {}GB, free: {}GB, disks: {}",
        total_disk / (1024 * 1024 * 1024),
        used_disk / (1024 * 1024 * 1024),
        free_disk / (1024 * 1024 * 1024),
        disk_usage.len()
    );

    // 不再断开连接，保留给下次使用

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Ok(MonitorData {
        metrics: ServerMetrics {
            uptime,
            cpu_cores,
            total_memory,
            used_memory,
            free_memory,
            total_disk,
            used_disk,
            free_disk,
            load_average,
            current_upload_rate: 0, // 由前端计算
            current_download_rate: 0,
            rx_bytes, // 累计接收字节数
            tx_bytes, // 累计发送字节数
        },
        history: vec![],
        processes,
        disk_usage,
        network_connections,
        last_updated: now,
    })
}

/// 关闭监控会话（当窗口关闭时调用）
#[tauri::command]
pub async fn close_monitor_session(session_id: String) {
    log::info!("[Monitor] Closing session: {}", session_id);
    let mut manager = MANAGER.lock().await;
    manager.remove_session(&session_id).await;
}
