/**
 * 权限管理 Store
 *
 * 管理会话级权限（内存存储，不持久化）
 * 权限与聊天会话 ID 绑定，不同会话的权限相互独立
 */

import { create } from 'zustand';
import type { SessionPermissions, PermissionCheckResult } from '../types/permissions';

interface PermissionStore {
  // ========== 状态 ==========
  /** 当前活跃的聊天会话 ID */
  activeChatId: string | null;
  /** 按聊天会话 ID 存储的权限（内存存储，刷新后清除） */
  permissionsByChatId: Record<string, SessionPermissions>;

  // ========== 会话管理 ==========
  /** 设置当前活跃的聊天会话 ID */
  setActiveChatId: (chatId: string | null) => void;

  // ========== 会话权限管理 ==========
  /** 添加命令到当前聊天会话白名单 */
  addSessionCommand: (command: string) => void;
  /** 添加服务器到当前聊天会话白名单 */
  addSessionServer: (serverId: string) => void;
  /** 检查命令是否在当前聊天会话白名单中 */
  isCommandAllowedInSession: (command: string, serverId: string) => PermissionCheckResult;
  /** 清除当前聊天会话的权限 */
  clearSessionPermissions: () => void;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  // ========== 初始状态 ==========
  activeChatId: null,
  permissionsByChatId: {},

  // ========== 会话管理 ==========

  setActiveChatId: (chatId) => {
    set({ activeChatId: chatId });
    // 如果该会话还没有权限记录，初始化一个空的
    if (chatId) {
      set((state) => {
        if (!state.permissionsByChatId[chatId]) {
          return {
            permissionsByChatId: {
              ...state.permissionsByChatId,
              [chatId]: { commands: [], servers: [] },
            },
          };
        }
        return state;
      });
    }
    console.log('[PermissionStore] Active chat ID set to:', chatId);
  },

  // ========== 会话权限管理 ==========

  addSessionCommand: (command) => {
    const { activeChatId, permissionsByChatId } = get();
    if (!activeChatId) {
      console.warn('[PermissionStore] No active chat ID, cannot add command permission');
      return;
    }

    const currentPermissions = permissionsByChatId[activeChatId] || { commands: [], servers: [] };

    // 避免重复添加
    if (currentPermissions.commands.includes(command)) {
      return;
    }

    set({
      permissionsByChatId: {
        ...permissionsByChatId,
        [activeChatId]: {
          ...currentPermissions,
          commands: [...currentPermissions.commands, command],
        },
      },
    });
    console.log('[PermissionStore] Added command permission for chat', activeChatId, ':', command);
  },

  addSessionServer: (serverId) => {
    const { activeChatId, permissionsByChatId } = get();
    if (!activeChatId) {
      console.warn('[PermissionStore] No active chat ID, cannot add server permission');
      return;
    }

    const currentPermissions = permissionsByChatId[activeChatId] || { commands: [], servers: [] };

    // 避免重复添加
    if (currentPermissions.servers.includes(serverId)) {
      return;
    }

    set({
      permissionsByChatId: {
        ...permissionsByChatId,
        [activeChatId]: {
          ...currentPermissions,
          servers: [...currentPermissions.servers, serverId],
        },
      },
    });
    console.log('[PermissionStore] Added server permission for chat', activeChatId, ':', serverId);
  },

  isCommandAllowedInSession: (command, serverId) => {
    const { activeChatId, permissionsByChatId } = get();

    if (!activeChatId) {
      return { allowed: false, reason: 'denied' };
    }

    const currentPermissions = permissionsByChatId[activeChatId];
    if (!currentPermissions) {
      return { allowed: false, reason: 'denied' };
    }

    // 检查命令是否在白名单
    if (currentPermissions.commands.includes(command)) {
      return { allowed: true, reason: 'session-command' };
    }

    // 检查服务器是否在白名单
    if (currentPermissions.servers.includes(serverId)) {
      return { allowed: true, reason: 'session-server' };
    }

    return { allowed: false, reason: 'denied' };
  },

  clearSessionPermissions: () => {
    const { activeChatId, permissionsByChatId } = get();
    if (!activeChatId) return;

    set({
      permissionsByChatId: {
        ...permissionsByChatId,
        [activeChatId]: { commands: [], servers: [] },
      },
    });
    console.log('[PermissionStore] Session permissions cleared for chat:', activeChatId);
  },
}));

// 导出类型
export type { PermissionStore };
