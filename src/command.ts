/**
 * Tauri Rust 命令声明
 *
 * 此文件提供 Rust 命令的 TypeScript 类型安全调用方式
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 保存 store 并通知其他窗口重新水合
 *
 * @param storeName - Store 文件名（如 "app-store.json"）
 * @param currentWindow - 当前窗口的 label
 */
export async function storeSave(
  storeName: string,
  currentWindow: string,
): Promise<void> {
  return invoke('store_save', { storeName, currentWindow });
}

/**
 * 直接从磁盘读取 store 的原始 JSON 内容
 *
 * 用于在导入数据后强制刷新前端状态，绕过 Tauri store 的缓存
 *
 * @param storeName - Store 文件名（如 "app-store.json"）
 * @returns Store 的完整 JSON 内容
 */
export async function storeReadRaw(
  storeName: string,
): Promise<any> {
  return invoke('store_read_raw', { storeName });
}

// ==================== SSH 相关类型和命令 ====================

/**
 * SSH 连接配置
 */
export interface SSHConnectConfig {
  /** 会话 ID */
  session_id: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码（可选，如果使用私钥认证则不需要） */
  password?: string;
  /** 私钥文件路径（可选，如果使用密码认证则不需要） */
  private_key_path?: string;
  /** 私钥密码短语（可选，如果私钥无密码保护则不需要） */
  key_passphrase?: string;
  /** 终端列数 */
  cols: number;
  /** 终端行数 */
  rows: number;
}

/**
 * SSH 会话信息
 */
export interface SSHSessionInfo {
  /** 会话 ID */
  session_id: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  username: string;
  /** 连接状态 */
  status: string;
}

/**
 * 连接到 SSH 服务器
 *
 * @param config - SSH 连接配置
 * @returns 会话 ID
 */
export async function sshConnect(config: SSHConnectConfig): Promise<string> {
  return invoke('ssh_connect', { config });
}

/**
 * 向 SSH 会话写入数据
 *
 * @param sessionId - 会话 ID
 * @param data - 要写入的数据
 */
export async function sshWrite(sessionId: string, data: string): Promise<void> {
  return invoke('ssh_write', { sessionId, data });
}

/**
 * 调整 SSH 会话的终端尺寸
 *
 * @param sessionId - 会话 ID
 * @param cols - 列数
 * @param rows - 行数
 */
export async function sshResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke('ssh_resize', { sessionId, cols, rows });
}

/**
 * 关闭 SSH 会话
 *
 * @param sessionId - 会话 ID
 */
export async function sshClose(sessionId: string): Promise<void> {
  return invoke('ssh_close', { sessionId });
}

/**
 * 获取所有活动会话的信息
 *
 * @returns 会话信息列表
 */
export async function sshListSessions(): Promise<SSHSessionInfo[]> {
  return invoke('ssh_list_sessions');
}

/**
 * 获取私钥密码短语
 *
 * @param keyPath - 私钥文件路径
 * @returns 密码短语，如果不存在则返回 null
 */
export async function sshGetKeyPassphrase(keyPath: string): Promise<string | null> {
  return invoke('ssh_get_key_passphrase', { keyPath });
}

// ==================== Monitor 相关类型和命令 ====================

/**
 * Monitor 连接配置
 */
export interface MonitorConnectConfig {
  /** 会话 ID */
  sessionId: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码（可选，如果使用私钥认证则不需要） */
  password?: string;
  /** 私钥文件路径（可选，如果使用密码认证则不需要） */
  privateKeyPath?: string;
  /** 私钥密码短语（可选，如果私钥无密码保护则不需要） */
  keyPassphrase?: string;
}

/**
 * 获取监控数据
 *
 * @param config - Monitor 连接配置
 * @returns 监控数据
 */
export async function getMonitorData(config: MonitorConnectConfig): Promise<any> {
  return invoke('get_monitor_data', { config });
}

/**
 * 关闭监控会话
 *
 * @param sessionId - 会话 ID
 */
export async function closeMonitorSession(sessionId: string): Promise<void> {
  return invoke('close_monitor_session', { sessionId });
}

// ==================== Backup 相关类型和命令 ====================

/**
 * 备份元数据
 */
export interface BackupMetadata {
  /** 备份格式版本 */
  version: string;
  /** 备份创建时间 */
  createdAt: string;
  /** 应用版本 */
  appVersion: string;
  /** 供应商数量 */
  providerCount: number;
  /** 数据校验和 */
  checksum: string;
}

/**
 * 供应商条目
 */
export interface ProviderEntry {
  /** 供应商 ID */
  id: string;
  /** 供应商名称 */
  name: string;
  /** 供应商类型 */
  providerType: string;
  /** API 基础 URL */
  baseUrl: string;
  /** API 密钥（可选） */
  apiKey?: string;
  /** 模型名称（可选） */
  model?: string;
  /** 其他设置 */
  settings: Record<string, any>;
}

/**
 * 备份错误类型
 */
export type BackupError =
  | { file_not_found: { path: string } }
  | { permission_denied: { path: string; reason: string } }
  | { invalid_zip_format: { reason: string } }
  | { empty_zip: null }
  | { missing_metadata: { found_files: string[] } }
  | { invalid_metadata: { reason: string } }
  | { no_data_files: { found_files: string[] } }
  | { checksum_mismatch: { expected: string; actual: string } }
  | { version_mismatch: { backup_version: string; current_version: string } }
  | { unknown: { reason: string } };

/**
 * 备份验证结果
 */
export interface BackupValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 验证消息 */
  message: string;
  /** 备份元数据（如果有效） */
  metadata?: BackupMetadata;
  /** 供应商列表（如果有效） */
  providers: ProviderEntry[];
  /** 错误类型（如果验证失败） */
  errorType?: BackupError;
  /** ZIP 文件内容列表（用于诊断） */
  zipContents?: string[];
  /** 建议的解决方案 */
  suggestions?: string[];
}

/**
 * 导出供应商配置到 ZIP 文件
 *
 * @param destPath - 目标文件路径
 * @param includeSensitive - 是否包含敏感数据（API 密钥）
 * @returns 导出消息
 */
export async function exportProviders(
  destPath: string,
  includeSensitive: boolean,
): Promise<string> {
  return invoke('export_providers', { destPath, includeSensitive });
}

/**
 * 验证备份 ZIP 文件
 *
 * @param zipPath - ZIP 文件路径
 * @returns 验证结果
 */
export async function validateBackup(
  zipPath: string,
): Promise<BackupValidationResult> {
  return invoke('validate_backup', { zipPath });
}

/**
 * 从 ZIP 文件导入供应商配置
 *
 * @param zipPath - ZIP 文件路径
 * @param replaceExisting - 是否替换现有配置
 * @returns 导入消息
 */
export async function importProviders(
  zipPath: string,
  replaceExisting: boolean,
): Promise<string> {
  return invoke('import_providers', { zipPath, replaceExisting });
}

// ==================== SFTP 相关类型和命令 ====================

/**
 * SFTP 连接配置（Rust 后端格式）
 */
export interface SFTPTauriConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  keyPassphrase?: string;
}

/**
 * SFTP 连接配置（前端格式）
 */
export interface SFTPConnectConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  keyPassphrase?: string;
}

/**
 * 构建 SFTP 命令配置对象（仅包含非空的可选字段）
 */
function buildSFTPConfig(config: SFTPConnectConfig): SFTPTauriConfig {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    ...(config.password && { password: config.password }),
    ...(config.privateKeyPath && { privateKeyPath: config.privateKeyPath }),
    ...(config.keyPassphrase && { keyPassphrase: config.keyPassphrase }),
  };
}

/**
 * 检查远程文件是否存在
 *
 * @param sessionId - 会话 ID
 * @param config - SFTP 连接配置
 * @param path - 远程文件路径
 * @returns 文件是否存在
 */
export async function sftpFileExists(
  sessionId: string,
  config: SFTPConnectConfig,
  path: string,
): Promise<boolean> {
  return invoke<boolean>('sftp_file_exists', {
    sessionId,
    config: buildSFTPConfig(config),
    path,
  });
}

/**
 * 获取远程当前工作目录
 *
 * @param sessionId - 会话 ID
 * @param config - SFTP 连接配置
 * @returns 当前工作目录的绝对路径
 */
export async function sftpGetCwd(
  sessionId: string,
  config: SFTPConnectConfig,
): Promise<string> {
  return invoke<string>('sftp_get_cwd', {
    sessionId,
    config: buildSFTPConfig(config),
  });
}
