// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

mod commands;
mod events;
mod ssh;
mod sftp;
mod backup;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger with info level
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting Tauri application...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();

            // Initialize SSH session store
            let session_store = ssh::init_session_store();
            app.manage(session_store);

            // Initialize SFTP session manager
            let sftp_manager = sftp::init_sftp_manager();
            app.manage(sftp_manager);

            // Start monitor session cleanup task (using Tauri async runtime)
            tauri::async_runtime::spawn(async move {
                commands::monitor::start_cleanup_task().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::store::store_save,
            commands::store::store_read_raw,
            ssh::ssh_connect,
            ssh::ssh_write,
            ssh::ssh_resize,
            ssh::ssh_close,
            ssh::ssh_list_sessions,
            ssh::ssh_get_key_passphrase,
            // SFTP commands
            commands::sftp::sftp_file_exists,
            commands::sftp::sftp_list_dir,
            commands::sftp::sftp_upload,
            commands::sftp::sftp_cancel_upload,
            commands::sftp::sftp_download,
            commands::sftp::sftp_delete,
            commands::sftp::sftp_mkdir,
            commands::sftp::sftp_rename,
            commands::sftp::sftp_close_session,
            commands::sftp::sftp_get_cwd,
            // Monitor commands
            commands::monitor::get_monitor_data,
            commands::monitor::close_monitor_session,
            // Tool commands
            commands::tools::tool_execute_command,
            commands::tools::submit_sudo_password,
            commands::tools::cancel_sudo_password,
            // Backup commands
            commands::backup::export_providers,
            commands::backup::validate_backup,
            commands::backup::import_providers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
