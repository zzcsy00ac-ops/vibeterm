// Backup metadata structures for ZIP archive import/export

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// Detailed error types for backup validation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackupError {
    /// File does not exist at the specified path
    FileNotFound {
        path: String,
    },
    /// No permission to read the file (macOS sandbox, etc.)
    PermissionDenied {
        path: String,
        reason: String,
    },
    /// File is not a valid ZIP archive
    InvalidZipFormat {
        reason: String,
    },
    /// ZIP file is empty (0 bytes or no entries)
    EmptyZip,
    /// ZIP file exists but backup_metadata.json is missing
    MissingMetadata {
        /// Files actually found in the ZIP
        found_files: Vec<String>,
    },
    /// backup_metadata.json exists but has invalid format
    InvalidMetadata {
        reason: String,
    },
    /// No data store files found in the ZIP
    NoDataFiles {
        /// Files actually found in the ZIP
        found_files: Vec<String>,
    },
    /// Data checksum does not match (file may be corrupted)
    ChecksumMismatch {
        expected: String,
        actual: String,
    },
    /// Backup version is not compatible with current app
    VersionMismatch {
        backup_version: String,
        current_version: String,
    },
    /// Unknown or unexpected error
    Unknown {
        reason: String,
    },
}

impl fmt::Display for BackupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BackupError::FileNotFound { path } => {
                write!(f, "File not found: {}\n\nThe selected file does not exist. It may have been moved or deleted.", path)
            }
            BackupError::PermissionDenied { path, reason } => {
                write!(f, "Permission denied: {}\n\nReason: {}\n\nOn macOS, this may be due to App Sandbox restrictions. Please ensure the file is accessible.", path, reason)
            }
            BackupError::InvalidZipFormat { reason } => {
                write!(f, "Invalid ZIP format\n\nThe selected file is not a valid ZIP archive.\n\nDetails: {}", reason)
            }
            BackupError::EmptyZip => {
                write!(f, "Empty ZIP file\n\nThe selected ZIP file contains no data.")
            }
            BackupError::MissingMetadata { found_files } => {
                if found_files.is_empty() {
                    write!(f, "Invalid backup file\n\nThis ZIP file does not appear to be a backup created by this application.\n\nMissing: backup_metadata.json\nZIP contents: (empty)")
                } else {
                    write!(f, "Invalid backup file\n\nThis ZIP file does not appear to be a backup created by this application.\n\nMissing: backup_metadata.json\nZIP contents:\n{}", found_files.iter().map(|f| format!("  - {}", f)).collect::<Vec<_>>().join("\n"))
                }
            }
            BackupError::InvalidMetadata { reason } => {
                write!(f, "Invalid metadata format\n\nThe backup_metadata.json file is corrupted or has an invalid format.\n\nDetails: {}", reason)
            }
            BackupError::NoDataFiles { found_files } => {
                write!(f, "No data files found\n\nThe backup ZIP does not contain any application data.\n\nZIP contents:\n{}", found_files.iter().map(|f| format!("  - {}", f)).collect::<Vec<_>>().join("\n"))
            }
            BackupError::ChecksumMismatch { expected, actual } => {
                write!(f, "Data corruption detected\n\nThe backup file may have been corrupted during transfer or storage.\n\nExpected checksum: {}\nActual checksum: {}", expected, actual)
            }
            BackupError::VersionMismatch { backup_version, current_version } => {
                write!(f, "Incompatible backup version\n\nBackup version: {}\nCurrent version: {}\n\nPlease use a backup created by the same or newer version of the application.", backup_version, current_version)
            }
            BackupError::Unknown { reason } => {
                write!(f, "Unexpected error\n\nDetails: {}", reason)
            }
        }
    }
}

/// Backup metadata stored in `backup_metadata.json` inside the ZIP archive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    /// Backup format version (for future migration)
    pub version: String,

    /// When the backup was created
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,

    /// App version that created this backup
    #[serde(rename = "appVersion", alias = "app_version")]
    pub app_version: String,

    /// Number of provider configurations in the backup
    #[serde(rename = "providerCount", alias = "provider_count")]
    pub provider_count: usize,

    /// Checksum for data integrity (SHA-256 of the data directory)
    pub checksum: String,
}

/// Individual provider configuration entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEntry {
    /// Provider unique identifier
    pub id: String,

    /// Provider name (e.g., "OpenAI", "Claude")
    pub name: String,

    /// Provider type (e.g., "openai", "anthropic")
    #[serde(rename = "type", alias = "provider_type")]
    pub provider_type: String,

    /// Base URL for API requests
    #[serde(rename = "baseUrl", alias = "base_url")]
    pub base_url: String,

    /// API key (encrypted or plain)
    #[serde(rename = "apiKey", alias = "api_key")]
    pub api_key: Option<String>,

    /// Model name
    pub model: Option<String>,

    /// Additional provider-specific settings
    pub settings: HashMap<String, serde_json::Value>,
}

/// Validation result for a backup ZIP archive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupValidationResult {
    /// Whether the backup is valid
    #[serde(rename = "isValid")]
    pub is_valid: bool,

    /// Human-readable validation message
    pub message: String,

    /// Metadata extracted from the backup (if valid)
    pub metadata: Option<BackupMetadata>,

    /// List of providers found in the backup (if valid)
    pub providers: Vec<ProviderEntry>,

    /// Detailed error type (if validation failed)
    #[serde(rename = "errorType", skip_serializing_if = "Option::is_none")]
    pub error_type: Option<BackupError>,

    /// Files found in the ZIP archive (for diagnosis)
    #[serde(rename = "zipContents", skip_serializing_if = "Option::is_none")]
    pub zip_contents: Option<Vec<String>>,

    /// Suggested solutions for the error
    #[serde(rename = "suggestions", skip_serializing_if = "Option::is_none")]
    pub suggestions: Option<Vec<String>>,
}

impl BackupValidationResult {
    /// Create a successful validation result
    pub fn success(message: String, metadata: BackupMetadata, providers: Vec<ProviderEntry>) -> Self {
        Self {
            is_valid: true,
            message,
            metadata: Some(metadata),
            providers,
            error_type: None,
            zip_contents: None,
            suggestions: None,
        }
    }

    /// Create a failed validation result with detailed error info
    pub fn failure(error: BackupError, zip_contents: Option<Vec<String>>) -> Self {
        let suggestions = Self::get_suggestions(&error);
        Self {
            is_valid: false,
            message: error.to_string(),
            metadata: None,
            providers: vec![],
            error_type: Some(error),
            zip_contents,
            suggestions,
        }
    }

    /// Get suggested solutions based on error type
    fn get_suggestions(error: &BackupError) -> Option<Vec<String>> {
        match error {
            BackupError::FileNotFound { .. } => Some(vec![
                "Check if the file has been moved or deleted".to_string(),
                "Try selecting the file again".to_string(),
            ]),
            BackupError::PermissionDenied { .. } => Some(vec![
                "On macOS: Try moving the file to a different location (e.g., Desktop)".to_string(),
                "Ensure the file is not in a protected system directory".to_string(),
            ]),
            BackupError::InvalidZipFormat { .. } => Some(vec![
                "Ensure the file is a valid ZIP archive".to_string(),
                "Try re-downloading or re-exporting the backup".to_string(),
            ]),
            BackupError::EmptyZip { .. } => Some(vec![
                "The ZIP file is empty. Please select a valid backup file.".to_string(),
            ]),
            BackupError::MissingMetadata { .. } => Some(vec![
                "This file was not created by this application's Export function".to_string(),
                "First use 'Export' to create a backup, then use 'Import' to restore".to_string(),
                "If you believe this is a valid backup, it may be corrupted".to_string(),
            ]),
            BackupError::InvalidMetadata { .. } => Some(vec![
                "The backup file may be corrupted".to_string(),
                "Try creating a new backup using the Export function".to_string(),
            ]),
            BackupError::NoDataFiles { .. } => Some(vec![
                "The backup ZIP does not contain any application data".to_string(),
                "Try creating a new backup using the Export function".to_string(),
            ]),
            BackupError::ChecksumMismatch { .. } => Some(vec![
                "The backup file may have been corrupted during transfer".to_string(),
                "Try re-downloading or re-exporting the backup".to_string(),
            ]),
            BackupError::VersionMismatch { .. } => Some(vec![
                "Update the application to the latest version".to_string(),
                "Or use a backup created by the current version".to_string(),
            ]),
            BackupError::Unknown { .. } => Some(vec![
                "Please try again or contact support".to_string(),
            ]),
        }
    }
}

/// Configuration for backup creation
#[derive(Debug, Clone)]
pub struct BackupConfig {
    /// App version string to include in backup
    pub app_version: String,

    /// Whether to include sensitive data (API keys)
    pub include_sensitive: bool,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            include_sensitive: true,
        }
    }
}

/// Backup format version (increment when structure changes)
pub const BACKUP_FORMAT_VERSION: &str = "1.0";
