/**
 * SSH Keychain 工具函数
 *
 * 提供与系统 Keychain 交互的辅助函数
 */

import { getPassword } from 'tauri-plugin-keyring-api';

/**
 * 生成 Keyring 服务名称
 *
 * @param username - SSH 用户名
 * @param host - SSH 主机地址
 * @returns Keyring 服务名称
 */
export function getSSHKeyringService(username: string, host: string): string {
  return `ssh:${username}@${host}`;
}

/**
 * 检查密码是否已保存到 Keychain
 *
 * @param username - SSH 用户名
 * @param host - SSH 主机地址
 * @returns Promise<boolean> - 是否已保存密码
 */
export async function checkPasswordStatus(
  username: string | undefined,
  host: string | undefined
): Promise<boolean> {
  if (!username || !host) return false;

  const service = getSSHKeyringService(username, host);

  try {
    await getPassword(service, username);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查私钥密码短语是否已保存到 Keychain
 *
 * @param privateKeyPath - 私钥文件路径
 * @returns Promise<boolean> - 是否已保存密码短语
 */
export async function checkKeyPassphraseStatus(
  privateKeyPath: string | undefined
): Promise<boolean> {
  if (!privateKeyPath) return false;

  // 使用私钥路径作为服务名称的一部分
  const service = `ssh:key:${privateKeyPath}`;

  try {
    await getPassword(service, privateKeyPath);
    return true;
  } catch {
    return false;
  }
}
