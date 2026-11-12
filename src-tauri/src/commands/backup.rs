//! Backup and restore functionality for all persistent data

use crate::backup::{BackupError, BackupMetadata, BackupValidationResult, ProviderEntry, BACKUP_FORMAT_VERSION};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tauri::path::BaseDirectory;
use tauri_plugin_store::StoreExt;
use zip::{write::FileOptions, ZipArchive, ZipWriter};

struct StoreConfig {
    filename: &'static str,
    display_name: &'static str,
}

const STORES: &[StoreConfig] = &[
    StoreConfig { filename: "app-store.json", display_name: "App Settings" },
    StoreConfig { filename: "provider-store.json", display_name: "Model Providers" },
    StoreConfig { filename: "chat-store.json", display_name: "Chat History" },
    StoreConfig { filename: "ssh-store.json", display_name: "SSH Profiles" },
];

fn get_app_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("", BaseDirectory::AppData)
        .map_err(|e| format!("Failed to resolve path: {}", e))
}

fn read_store_file(app: &AppHandle, filename: &str) -> Result<Option<serde_json::Value>, String> {
    let file_path = get_app_data_path(app)?.join(filename);

    if !file_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read {}: {}", filename, e))?;

    if content.trim().is_empty() {
        return Ok(None);
    }

    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("Failed to parse {}: {}", filename, e))
}

/// Export all persistent data to a ZIP archive
#[tauri::command]
pub async fn export_providers(
    app: AppHandle,
    dest_path: String,
    _include_sensitive: bool,
) -> Result<String, String> {
    let dest = Path::new(&dest_path);

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let file = File::create(dest)
        .map_err(|e| format!("Failed to create ZIP: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options: FileOptions<'_, ()> = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(9));

    zip.add_directory("stores/", options)
        .map_err(|e| format!("Failed to add directory: {}", e))?;

    let mut backed_up_stores = Vec::new();
    let mut all_data = String::new();

    for store_config in STORES {
        match read_store_file(&app, store_config.filename) {
            Ok(Some(store_value)) if !store_value.is_null() && !store_value.as_object().map(|o| o.is_empty()).unwrap_or(true) => {
                let store_json = serde_json::to_string_pretty(&store_value)
                    .map_err(|e| format!("Failed to serialize {}: {}", store_config.filename, e))?;

                let safe_filename = store_config.filename.replace(".json", "");
                zip.start_file(format!("stores/{}.json", safe_filename), options)
                    .map_err(|e| format!("Failed to create {}: {}", store_config.filename, e))?;
                zip.write_all(store_json.as_bytes())
                    .map_err(|e| format!("Failed to write {}: {}", store_config.filename, e))?;

                backed_up_stores.push(store_config.display_name);
                all_data.push_str(&store_json);
            }
            Ok(None) => {}
            Err(e) => {
                log::warn!("Failed to read {}: {}", store_config.filename, e);
            }
            _ => {}
        }
    }

    let checksum = calculate_checksum(&all_data);
    let metadata = BackupMetadata {
        version: BACKUP_FORMAT_VERSION.to_string(),
        created_at: chrono::Utc::now(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        provider_count: backed_up_stores.len(),
        checksum,
    };

    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    zip.start_file("backup_metadata.json", options)
        .map_err(|e| format!("Failed to create metadata: {}", e))?;
    zip.write_all(metadata_json.as_bytes())
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    Ok(format!("Exported {} data store(s) to {}", backed_up_stores.len(), dest_path))
}

/// Validate a backup ZIP archive with detailed error reporting
#[tauri::command]
pub async fn validate_backup(
    _app: AppHandle,
    zip_path: String,
) -> Result<BackupValidationResult, String> {
    let path = Path::new(&zip_path);

    // Step 1: Check if file exists
    if !path.exists() {
        return Ok(BackupValidationResult::failure(
            BackupError::FileNotFound { path: zip_path.clone() },
            None,
        ));
    }

    // Step 2: Check file metadata (size, etc.)
    let file_metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) => {
            let error_type = if e.kind() == std::io::ErrorKind::PermissionDenied {
                BackupError::PermissionDenied {
                    path: zip_path.clone(),
                    reason: e.to_string(),
                }
            } else {
                BackupError::Unknown { reason: e.to_string() }
            };
            return Ok(BackupValidationResult::failure(error_type, None));
        }
    };

    // Step 3: Check if file is empty
    if file_metadata.len() == 0 {
        return Ok(BackupValidationResult::failure(BackupError::EmptyZip, None));
    }

    // Step 4: Open the file
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            let error_type = if e.kind() == std::io::ErrorKind::PermissionDenied {
                BackupError::PermissionDenied {
                    path: zip_path.clone(),
                    reason: e.to_string(),
                }
            } else {
                BackupError::Unknown { reason: e.to_string() }
            };
            return Ok(BackupValidationResult::failure(error_type, None));
        }
    };

    // Step 5: Parse as ZIP archive
    let reader = BufReader::new(file);
    let mut archive = match ZipArchive::new(reader) {
        Ok(a) => a,
        Err(e) => {
            return Ok(BackupValidationResult::failure(
                BackupError::InvalidZipFormat { reason: e.to_string() },
                None,
            ));
        }
    };

    // Step 6: Collect all file names in the ZIP for diagnosis
    let mut zip_contents: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            zip_contents.push(file.name().to_string());
        }
    }

    // Step 7: Check if ZIP is empty (no entries)
    if archive.len() == 0 {
        return Ok(BackupValidationResult::failure(BackupError::EmptyZip, Some(zip_contents)));
    }

    // Step 8: Look for backup_metadata.json
    let metadata = match archive.by_name("backup_metadata.json") {
        Ok(mut file) => {
            let mut content = String::new();
            if let Err(e) = file.read_to_string(&mut content) {
                return Ok(BackupValidationResult::failure(
                    BackupError::InvalidMetadata { reason: format!("Failed to read: {}", e) },
                    Some(zip_contents),
                ));
            }
            match serde_json::from_str::<BackupMetadata>(&content) {
                Ok(m) => m,
                Err(e) => {
                    return Ok(BackupValidationResult::failure(
                        BackupError::InvalidMetadata { reason: e.to_string() },
                        Some(zip_contents),
                    ));
                }
            }
        }
        Err(_) => {
            return Ok(BackupValidationResult::failure(
                BackupError::MissingMetadata { found_files: zip_contents.clone() },
                Some(zip_contents),
            ));
        }
    };

    // Step 9: Collect data stores and calculate checksum
    let mut backed_up_stores = Vec::new();
    let mut all_data = String::new();

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(_) => continue,
        };

        let name = file.name().to_string();

        if name.starts_with("stores/") && name.ends_with(".json") {
            let mut content = String::new();
            if let Err(_) = file.read_to_string(&mut content) {
                continue;
            }

            let store_name = name
                .strip_prefix("stores/")
                .and_then(|s| s.strip_suffix(".json"))
                .unwrap_or("unknown");

            backed_up_stores.push(store_name.to_string());
            all_data.push_str(&content);
        }
    }

    // Step 10: Check if any data files exist
    if backed_up_stores.is_empty() {
        return Ok(BackupValidationResult::failure(
            BackupError::NoDataFiles { found_files: zip_contents.clone() },
            Some(zip_contents),
        ));
    }

    // Step 11: Verify checksum
    let calculated_checksum = calculate_checksum(&all_data);
    if calculated_checksum != metadata.checksum {
        return Ok(BackupValidationResult::failure(
            BackupError::ChecksumMismatch {
                expected: metadata.checksum.clone(),
                actual: calculated_checksum,
            },
            Some(zip_contents),
        ));
    }

    // Step 12: Verify version compatibility
    if metadata.version != BACKUP_FORMAT_VERSION {
        return Ok(BackupValidationResult::failure(
            BackupError::VersionMismatch {
                backup_version: metadata.version.clone(),
                current_version: BACKUP_FORMAT_VERSION.to_string(),
            },
            Some(zip_contents),
        ));
    }

    // Success!
    let formatted_date = metadata.created_at.format("%Y-%m-%d %H:%M:%S UTC").to_string();
    let final_message = format!(
        "Valid backup: {} data store(s), created on {}",
        backed_up_stores.len(),
        formatted_date
    );

    Ok(BackupValidationResult::success(
        final_message,
        metadata,
        backed_up_stores
            .into_iter()
            .map(|name| ProviderEntry {
                id: name.clone(),
                name: name.clone(),
                provider_type: "store".to_string(),
                base_url: String::new(),
                api_key: None,
                model: None,
                settings: HashMap::new(),
            })
            .collect(),
    ))
}

/// Import all persistent data from a ZIP archive
///
/// This function uses Tauri Store API to update both in-memory state and disk files,
/// ensuring that imported data is not overwritten by subsequent save operations.
#[tauri::command]
pub async fn import_providers(
    app: AppHandle,
    zip_path: String,
    replace_existing: bool,
) -> Result<String, String> {
    let validation = validate_backup(app.clone(), zip_path.clone()).await?;

    if !validation.is_valid {
        return Err(format!("Invalid backup: {}", validation.message));
    }

    let path = Path::new(&zip_path);
    let file = File::open(path)
        .map_err(|e| format!("Failed to open ZIP: {}", e))?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;

    let mut imported_count = 0;
    let mut imported_stores = Vec::new();

    for i in 0..archive.len() {
        let file_path = match archive.by_index(i) {
            Ok(f) => f.name().to_string(),
            Err(_) => continue,
        };

        if !file_path.starts_with("stores/") || !file_path.ends_with(".json") {
            continue;
        }

        let store_name = file_path
            .strip_prefix("stores/")
            .and_then(|s| s.strip_suffix(".json"))
            .unwrap_or("unknown");

        // Map store names to their Tauri Store filenames
        let store_filename = match store_name {
            "app-store" => "app-store.json".to_string(),
            "provider-store" => "provider-store.json".to_string(),
            "chat-store" => "chat-store.json".to_string(),
            "ssh-store" => "ssh-store.json".to_string(),
            _ => format!("{}.json", store_name),
        };

        // Read the store data from ZIP
        let mut content = String::new();
        let mut file_reader = match archive.by_index(i) {
            Ok(f) => f,
            Err(_) => continue,
        };

        file_reader.read_to_string(&mut content)
            .map_err(|e| format!("Failed to read file content: {}", e))?;

        let imported_data: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse {}: {}", store_filename, e))?;

        // Get the Tauri Store instance
        let store = app.store(&store_filename)
            .map_err(|e| format!("Failed to get store {}: {}", store_filename, e))?;

        if replace_existing {
            // Replace mode: clear existing keys and set imported data
            let imported_obj = imported_data.as_object()
                .ok_or_else(|| format!("Imported data for {} is not an object", store_filename))?;

            for (key, value) in imported_obj {
                store.set(key, value.clone());
                imported_count += 1;
            }
        } else {
            // Merge mode: only add keys that don't exist
            let imported_obj = imported_data.as_object()
                .ok_or_else(|| format!("Imported data for {} is not an object", store_filename))?;

            for (key, value) in imported_obj {
                // Check if key already exists
                if store.has(key) {
                    continue;
                }
                store.set(key, value.clone());
                imported_count += 1;
            }
        }

        // Save the store to disk
        store.save()
            .map_err(|e| format!("Failed to save store {}: {}", store_filename, e))?;

        let display_name = match store_name {
            "app-store" => "App Settings",
            "provider-store" => "Model Providers",
            "chat-store" => "Chat History",
            "ssh-store" => "SSH Profiles",
            _ => store_name,
        };
        imported_stores.push(display_name.to_string());
    }

    // Notify all windows to rehydrate from the updated stores
    for (_label, window) in app.webview_windows().iter() {
        let _ = window.emit("rehydrate", ());
    }

    Ok(format!("Imported {} data item(s) from {} store(s): {}",
        imported_count, imported_stores.len(), imported_stores.join(", ")))
}

fn calculate_checksum(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}
