/**
 * SSHTerminal 组件类型定义
 */

import type { XtermTerminalRef } from '../XtermTerminal/XtermTerminal.types';

/**
 * SSHTerminal 组件 Props
 */
export interface SSHTerminalProps {
  /** 会话 ID */
  sessionId: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port?: number;
  /** 用户名 */
  username: string;
  /** 密码（可选，如果从 keyring 读取则不需要） */
  password?: string;
  /** 私钥文件路径（可选，如果使用密码认证则不需要） */
  privateKeyPath?: string;
  /** 自动连接（默认 true） */
  autoConnect?: boolean;
  /** 连接状态变化回调 */
  onStatusChange?: (status: SSHConnectionStatus) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 组件卸载时是否断开连接（默认 true） */
  disconnectOnUnmount?: boolean;
}

/**
 * SSH 连接状态
 */
export type SSHConnectionStatus =
  | 'disconnected'   // 未连接
  | 'connecting'     // 连接中
  | 'connected'      // 已连接
  | 'reconnecting'   // 重连中
  | 'stale'          // 连接超时（可能已断开）
  | 'error';         // 错误

/**
 * SSHTerminal 组件暴露的方法
 */
export interface SSHTerminalRef {
  /** 终端引用 */
  terminal: XtermTerminalRef | null;
  /** 连接状态 */
  status: SSHConnectionStatus;
  /** 连接 */
  connect: () => Promise<void>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 重连 */
  reconnect: () => Promise<void>;
  /** 写入数据 */
  write: (data: string) => Promise<void>;
}
