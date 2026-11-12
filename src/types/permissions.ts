/**
 * 权限管理类型定义
 *
 * 用于 HITL (Human-in-the-Loop) 场景的权限控制
 */

/**
 * 权限范围
 */
export type PermissionScope =
  | 'session'     // 当前会话有效（不持久化）
  | 'global';     // 全局有效（持久化，后续扩展）

/**
 * 批准选项类型
 */
export type ApprovalRememberType =
  | 'none'        // 仅此次执行
  | 'command'     // 此会话中始终允许此命令
  | 'server';     // 此会话中始终允许在此服务器执行

/**
 * 批准选项
 */
export interface ApprovalOptions {
  /** 记住类型 */
  rememberType: ApprovalRememberType;
}

/**
 * 会话权限（内存存储，不持久化）
 */
export interface SessionPermissions {
  /** 已批准的命令模式列表 */
  commands: string[];
  /** 已批准的服务器 ID 列表 */
  servers: string[];
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  /** 是否允许执行 */
  allowed: boolean;
  /** 允许原因 */
  reason: 'session-command' | 'session-server' | 'denied';
}
