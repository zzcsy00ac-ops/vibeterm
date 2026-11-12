/**
 * SFTP Tauri Commands
 *
 * 实现 SFTP 文件操作命令
 */

use crate::sftp::{SFTPConnectConfig, SFTPFile, SFTPSessionManager};
use std::fs::File;
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{Emitter, State, Window};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;

/// 检查文件是否存在
#[tauri::command]
pub async fn sftp_file_exists(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
    path: String,
) -> Result<bool, String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    // 尝试获取文件元数据来判断文件是否存在
    match wrapper.sftp.metadata(&path).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// 列出目录内容
#[tauri::command]
pub async fn sftp_list_dir(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
    path: String,
) -> Result<Vec<SFTPFile>, String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    // 使用 russh-sftp 的 read_dir 方法
    let entries = wrapper
        .sftp
        .read_dir(&path)
        .await
        .map_err(|e| format!("Failed to list directory: {}", e))?;

    let files: Vec<SFTPFile> = entries
        .map(|entry| {
            let metadata = entry.metadata();

            // Unix 文件类型常量
            const S_IFDIR: u32 = 0o0040000; // 目录 (八进制 0040000)
            const S_IFLNK: u32 = 0o0120000; // 符号链接
            const S_IFREG: u32 = 0o0100000; // 普通文件

            // 获取权限位（permissions 字段只包含权限，不包含文件类型）
            let perm_bits = metadata.permissions.unwrap_or(0);

            // 根据文件类型添加相应的类型位
            let file_type_bit = if metadata.is_symlink() {
                S_IFLNK
            } else if metadata.is_dir() {
                S_IFDIR
            } else {
                S_IFREG
            };

            // 组合文件类型和权限
            let full_mode = file_type_bit | perm_bits;

            SFTPFile {
                name: entry.file_name(),
                full_path: format!("{}/{}", path.trim_end_matches('/'), entry.file_name()),
                is_directory: metadata.is_dir(),
                is_symlink: metadata.is_symlink(),
                size: metadata.size.unwrap_or(0),
                mode: full_mode,
                mtime: metadata.mtime.unwrap_or(0) as i64,
            }
        })
        .collect();

    Ok(files)
}

/// 上传文件
#[tauri::command]
pub async fn sftp_upload(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    window: Window,
    session_id: String,
    config: SFTPConnectConfig,
    local_path: String,
    remote_path: String,
    #[allow(unused_variables)]
    resume_from: Option<u64>,
) -> Result<(), String> {
    // 注册上传并获取取消接收器
    let (_upload_session, mut cancel_rx) = {
        let mut manager = sftp_manager.lock().await;
        manager.register_upload(session_id.clone(), remote_path.clone())
    };

    // 读取本地文件
    let mut file = File::open(&local_path)
        .map_err(|e| format!("Failed to open local file: {}", e))?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();

    // 确定起始上传位置
    let start_pos = resume_from.unwrap_or(0);

    // 如果需要断点续传，先定位到指定位置
    if start_pos > 0 {
        use std::io::Seek;
        file
            .seek(std::io::SeekFrom::Start(start_pos))
            .map_err(|e| format!("Failed to seek to position {}: {}", start_pos, e))?;
    }

    // 获取 SFTP 会话（在新的作用域中，让锁被释放）
    let mut remote_file = {
        let mut manager = sftp_manager.lock().await;
        let wrapper = manager
            .get_or_create_session(&session_id, &config)
            .await?;

        // 创建或打开远程文件
        use russh_sftp::protocol::OpenFlags;

        // 如果 resume_from 存在，使用 APPEND 模式（追加写入）
        // 否则使用 TRUNCATE 模式（从头开始）
        let flags = if resume_from.is_some() {
            OpenFlags::CREATE | OpenFlags::WRITE | OpenFlags::APPEND
        } else {
            OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE
        };

        wrapper
            .sftp
            .open_with_flags(&remote_path, flags)
            .await
            .map_err(|e| format!("Failed to create remote file: {}", e))?
    };

    // 分块读取并上传
    let mut buffer = vec![0u8; 8192]; // 8KB chunks
    let mut uploaded = start_pos; // 从起始位置开始计数

    loop {
        // 检查取消信号
        match cancel_rx.try_recv() {
            Ok(_) => {
                // 用户取消，清理资源
                let _ = remote_file.shutdown().await;
                {
                    let mut manager = sftp_manager.lock().await;
                    manager.unregister_upload(session_id.clone(), remote_path.clone());
                }
                return Err("Upload cancelled by user".to_string());
            }
            Err(tokio::sync::broadcast::error::TryRecvError::Empty) => {
                // 继续上传
            }
            Err(tokio::sync::broadcast::error::TryRecvError::Closed) => {
                break;
            }
            Err(tokio::sync::broadcast::error::TryRecvError::Lagged(_)) => {
                // 接收器滞后，但仍然存在，继续上传
            }
        }

        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        if n == 0 {
            break;
        }

        remote_file
            .write_all(&buffer[..n])
            .await
            .map_err(|e| format!("Failed to write to remote: {}", e))?;

        uploaded += n as u64;

        // 发送进度事件
        let progress = (uploaded as f64 / file_size as f64) * 100.0;
        let _ = window.emit(
            &format!("sftp://upload_progress/{}", session_id),
            serde_json::json!({"path": remote_path, "progress": progress}),
        );
    }

    // 关闭文件
    remote_file
        .shutdown()
        .await
        .map_err(|e| format!("Failed to close remote file: {}", e))?;

    // 注销上传会话
    {
        let mut manager = sftp_manager.lock().await;
        manager.unregister_upload(session_id.clone(), remote_path.clone());
    }

    // 发送上传完成事件
    let _ = window.emit(
        &format!("sftp://upload_complete/{}", session_id),
        serde_json::json!({
            "path": remote_path,
            "success": true
        }),
    );

    Ok(())
}

/// 取消上传
#[tauri::command]
pub async fn sftp_cancel_upload(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    remote_path: String,
) -> Result<(), String> {
    let mut manager = sftp_manager.lock().await;
    manager.cancel_upload(session_id, remote_path)
}

/// 下载文件
#[tauri::command]
pub async fn sftp_download(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    window: Window,
    session_id: String,
    config: SFTPConnectConfig,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    // 打开远程文件
    let mut remote_file = wrapper
        .sftp
        .open(&remote_path)
        .await
        .map_err(|e| format!("Failed to open remote file: {}", e))?;

    // 获取文件大小
    let file_metadata = remote_file
        .metadata()
        .await
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = file_metadata.size.unwrap_or(0);

    // 创建本地文件
    let mut local_file = File::create(&local_path)
        .map_err(|e| format!("Failed to create local file: {}", e))?;

    // 分块下载
    let mut buffer = vec![0u8; 8192]; // 8KB chunks
    let mut downloaded = 0u64;

    loop {
        let n = remote_file
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read from remote: {}", e))?;
        if n == 0 {
            break;
        }

        local_file
            .write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write to local file: {}", e))?;

        downloaded += n as u64;

        // 发送进度事件
        let progress = if file_size > 0 {
            (downloaded as f64 / file_size as f64) * 100.0
        } else {
            0.0
        };
        let _ = window.emit(
            &format!("sftp://download_progress/{}", session_id),
            serde_json::json!({"path": remote_path, "progress": progress}),
        );
    }

    Ok(())
}

/// 递归删除目录及其内容
async fn remove_dir_recursive(sftp: &russh_sftp::client::SftpSession, path: &str) -> Result<(), String> {
    // 读取目录内容
    let entries = sftp
        .read_dir(path)
        .await
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    // 递归删除所有内容
    for entry in entries {
        let entry_name = entry.file_name();
        let entry_path = format!("{}/{}", path.trim_end_matches('/'), entry_name);
        let metadata = entry.metadata();

        if metadata.is_dir() {
            // 递归删除子目录
            Box::pin(remove_dir_recursive(sftp, &entry_path)).await?;
        } else {
            // 删除文件
            sftp.remove_file(&entry_path)
                .await
                .map_err(|e| format!("Failed to remove file '{}': {}", entry_path, e))?;
        }
    }

    // 删除空目录
    sftp.remove_dir(path)
        .await
        .map_err(|e| format!("Failed to remove directory '{}': {}", path, e))?;

    Ok(())
}

/// 删除文件或目录
#[tauri::command]
pub async fn sftp_delete(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
    path: String,
    is_directory: bool,
) -> Result<(), String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    if is_directory {
        // 递归删除目录
        remove_dir_recursive(&wrapper.sftp, &path).await?;
    } else {
        // 删除文件
        wrapper
            .sftp
            .remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

/// 创建目录
#[tauri::command]
pub async fn sftp_mkdir(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
    path: String,
) -> Result<(), String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    wrapper
        .sftp
        .create_dir(&path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

/// 重命名文件或目录
#[tauri::command]
pub async fn sftp_rename(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    wrapper
        .sftp
        .rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

/// 关闭 SFTP 会话
#[tauri::command]
pub async fn sftp_close_session(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
) -> Result<(), String> {
    let mut manager: tokio::sync::MutexGuard<'_, SFTPSessionManager> = sftp_manager.lock().await;
    manager
        .close_session(&session_id)
        .await
        .map_err(|e| format!("Failed to close session: {}", e))?;
    Ok(())
}

/// 获取远程当前工作目录
#[tauri::command]
pub async fn sftp_get_cwd(
    sftp_manager: State<'_, Arc<Mutex<SFTPSessionManager>>>,
    session_id: String,
    config: SFTPConnectConfig,
) -> Result<String, String> {
    let mut manager = sftp_manager.lock().await;
    let wrapper = manager
        .get_or_create_session(&session_id, &config)
        .await?;

    wrapper
        .sftp
        .canonicalize(".")
        .await
        .map_err(|e| format!("Failed to get current directory: {}", e))
}
