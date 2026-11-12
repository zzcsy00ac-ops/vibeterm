//! Store-related commands for multi-window state synchronization

use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use tauri::path::BaseDirectory;
use tauri_plugin_store::StoreExt;

/// 保存 store 并通知其他窗口重新水合
#[tauri::command]
pub async fn store_save(
    app: AppHandle,
    store_name: String,
    current_window: String,
) -> Result<(), String> {
    let store = app.store(&store_name).map_err(|e| format!("Failed to get store: {}", e))?;
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    // 通知其他窗口重新加载数据
    for (label, window) in app.webview_windows().iter() {
        if label != &current_window {
            window.emit("rehydrate", ()).ok();
        }
    }

    Ok(())
}

/// 直接从磁盘读取 store 的原始 JSON 内容
///
/// 用于在导入数据后强制刷新前端状态，绕过 Tauri store 的缓存
#[tauri::command]
pub async fn store_read_raw(
    app: AppHandle,
    store_name: String,
) -> Result<Value, String> {
    let app_data_path = app.path()
        .resolve("", BaseDirectory::AppData)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    let file_path = Path::new(&app_data_path).join(&store_name);

    if !file_path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read {}: {}", store_name, e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", store_name, e))
}
