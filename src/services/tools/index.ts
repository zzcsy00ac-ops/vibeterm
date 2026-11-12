/**
 * Agent 工具注册表
 *
 * 定义 Agent 可调用的工具列表
 */

import { tool } from 'ai';
import { z } from 'zod';
import { invokeWithTimeout, InvokeTimeoutError } from '../../utils/invokeWithTimeout';
import type { SSHProfile } from '../../types/ssh';
import { calculateExpression } from './calculateExpression';
import { getCurrentTime } from './getCurrentTime';

/**
 * 工具 1: 查询 SSH 服务器列表
 */
export const listSSHServers = tool({
  description: '查询用户已配置的 SSH 服务器列表，用于了解可以在哪些服务器上执行操作',

  inputSchema: z.object({
    filter: z.string().optional().describe('可选的过滤条件，可以是服务器名称或 IP 地址的一部分'),
  }),

  execute: async ({ filter }) => {
    const { useSSHStore } = await import('../../store/sshStore');

    // 等待 store 完成数据加载
    let profiles: SSHProfile[] = useSSHStore.getState().profiles;
    const state = useSSHStore.getState();
    if (!state._hydrated) {
      await new Promise(resolve => setTimeout(resolve, 100));
      profiles = useSSHStore.getState().profiles;
    }

    // 应用过滤条件
    let filteredProfiles = profiles;
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filteredProfiles = profiles.filter(p =>
        p.name.toLowerCase().includes(lowerFilter) ||
        p.host.toLowerCase().includes(lowerFilter)
      );
    }

    // 返回完整的服务器信息，让 AI 可以根据 id 来调用 executeCommand
    return {
      servers: filteredProfiles.map(p => ({
        id: p.id,
        name: p.name,
        host: p.host,
        port: p.port,
        username: p.username || '<未设置>',
        authType: p.authType,
      })),
      total: filteredProfiles.length,
      note: '注意：配置 ID 可能会因为配置更新而变化。建议在调用 executeCommand 前重新调用 listSSHServers 获取最新的配置列表。',
    };
  },
});

/**
 * 工具 2: 执行命令（PTY 流式模式，支持条件智能停止）
 *
 * - PTY 模式支持实时输出检测和交互
 * - AI 可指定成功/失败条件，匹配时自动返回
 * - 支持 sudo 密码按需输入（通过本地弹窗，完全隔离于 AI）
 * - 执行前需要用户确认
 */
export const executeCommand = tool({
  description: '在远程服务器执行 shell 命令，支持条件自动停止。使用 PTY 模式实时检测输出并根据条件提前返回，适合长时间运行的命令或需要交互的场景（如 sudo 密码输入）。自行判断是否需要加sudo',
  
  inputSchema: z.object({
    serverId: z.string().describe('SSH 配置 ID（可通过 listSSHServers 获取）'),
    command: z.string().describe('要执行的 shell 命令'),
    reason: z.string().describe('执行此命令的理由，用于向用户说明目的'),
    stopOnSuccess: z.string().optional()
      .describe('检测到此文本时认为成功并停止（支持 | 分隔多个模式，如 "Server started|listening on|ready"）。不设置则等待命令完成'),
    stopOnError: z.string().optional()
      .describe('检测到此文本时认为失败并停止（支持 | 分隔多个模式，如 "ERROR|FATAL|failed"）。不设置则等待命令完成'),
    maxWaitTime: z.number().optional()
      .describe('最长等待时间（秒），默认 30 秒。适用于可能长时间运行的命令'),
  }),

  needsApproval: async ({ serverId, command }) => {
    // 动态导入权限 Store
    const { usePermissionStore } = await import('../../store/permissionStore');
    const { isCommandAllowedInSession } = usePermissionStore.getState();

    // 检查是否在会话白名单中
    const result = isCommandAllowedInSession(command, serverId);

    if (result.allowed) {
      console.log('[executeCommand] Auto-approved:', result.reason);
      return false; // 不需要审批
    }

    return true; // 需要审批
  },

  execute: async ({ serverId, command, stopOnSuccess, stopOnError, maxWaitTime = 30 }) => {
    try {
      const { useSSHStore } = await import('../../store/sshStore');
      const { getPassword } = await import('tauri-plugin-keyring-api');
      const { sshGetKeyPassphrase } = await import('../../command');

      // 处理可能被双重序列化的 serverId
      let actualServerId = serverId;
      if (serverId.startsWith('"') && serverId.endsWith('"')) {
        try {
          actualServerId = JSON.parse(serverId);
        } catch {
          // 解析失败，使用原始值
        }
      }

      // 等待 store 完成数据加载
      const state = useSSHStore.getState();
      if (!state._hydrated) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const profile = useSSHStore.getState().getProfile(actualServerId);

      if (!profile) {
        const currentState = useSSHStore.getState();
        const allProfiles = currentState.profiles;
        const profileNames = allProfiles.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');

        throw new Error(
          `SSH 配置不存在 (ID: ${actualServerId})。\n\n` +
          `可能原因：\n` +
          `1. 该配置已被删除\n` +
          `2. 配置已更新，ID 发生了变化\n\n` +
          `请先使用 listSSHServers 工具查询当前可用的配置列表。\n\n` +
          `当前可用的配置：\n${profileNames || '(无)'}`
        );
      }

      // 根据认证方式获取凭证
      let config: {
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKeyPath?: string;
        keyPassphrase?: string;
      } = {
        host: profile.host,
        port: profile.port,
        username: profile.username || '',
      };

      if (profile.authType === 'key' && profile.privateKeyPath) {
        // 密钥认证：获取密码短语
        try {
          const passphrase = await sshGetKeyPassphrase(profile.privateKeyPath);
          const finalPassphrase = (!passphrase || passphrase === '') ? '<none>' : passphrase;
          config.privateKeyPath = profile.privateKeyPath;
          config.keyPassphrase = finalPassphrase;
        } catch {
          // 密钥没有密码短语
          config.privateKeyPath = profile.privateKeyPath;
          config.keyPassphrase = '<none>';
        }
      } else {
        // 密码认证或其他模式：从 keychain 获取密码
        const username = profile.username || '';
        try {
          const pwd = await getPassword(`ssh:${username}@${profile.host}`, username);
          if (pwd) {
            config.password = pwd;
          } else {
            throw new Error(`No credentials found for ${profile.name}. Please save the password first.`);
          }
        } catch {
          throw new Error(`No credentials found for ${profile.name}. Please save the password first.`);
        }
      }

      // 使用带超时的 invoke
      // 前端超时 = Rust 端超时阈值 + 30秒缓冲
      // 规则：默认 30 秒，模型指定 >= 30s 时用 maxWaitTime + 300ms
      const rustTimeoutThreshold = maxWaitTime >= 30 ? maxWaitTime + 0.3 : 30;
      const frontendTimeout = (rustTimeoutThreshold + 30) * 1000;

      const result = await invokeWithTimeout<{
        success: boolean;
        exit_code?: number;
        stdout?: string;
        stderr?: string;
        stopped_by?: 'Success' | 'Error' | null;
        error?: string;
        timed_out: boolean;
      }>(
        'tool_execute_command',
        {
          sessionId: actualServerId,
          config,
          command,
          stopOnSuccess,
          stopOnError,
          maxWaitTime,
        },
        frontendTimeout // 动态超时时间
      );

      // 调试日志
      console.log('[executeCommand] Result:', {
        success: result.success,
        exit_code: result.exit_code,
        stdout: result.stdout?.substring(0, 50),
        stderr: result.stderr?.substring(0, 50),
        error: result.error,
        timed_out: result.timed_out,
      });

      // 构建返回结果
      if (result.success && result.stdout) {
        let output = result.stdout;
        if (result.stderr) {
          output += `\n[stderr]\n${result.stderr}`;
        }
        if (result.stopped_by) {
          const reason = result.stopped_by === 'Success' ? 'success' : 'error';
          output += `\n\n[Command stopped after detecting ${reason} condition]`;
        }
        return output;
      } else if (!result.success) {
        // 有退出码时显示退出码信息
        if (result.exit_code !== undefined && result.exit_code !== null) {
          let errorMsg = `Error: Command failed with exit code ${result.exit_code}`;
          if (result.stdout) {
            errorMsg += `\n\n[stdout]\n${result.stdout}`;
          }
          if (result.stderr) {
            errorMsg += `\n\n[stderr]\n${result.stderr}`;
          }
          if (result.error) {
            errorMsg += `\n\n[Error message]\n${result.error}`;
          }
          if (result.stopped_by) {
            errorMsg += `\n\n[Reason: detected ${result.stopped_by} condition]`;
          }
          return errorMsg;
        }

        // 没有退出码但有错误信息
        let errorMsg = `Error: ${result.error || result.stderr || 'Command failed'}`;
        if (result.stdout) {
          errorMsg += `\n\n[Output]\n${result.stdout}`;
        }
        if (result.stopped_by) {
          errorMsg += `\n[Reason: detected ${result.stopped_by} condition]`;
        }
        // Rust 端超时（命令执行时间超过 maxWaitTime）
        if (result.timed_out) {
          return `Error: Command execution timed out on the server (maxWaitTime: ${maxWaitTime}s).\n\nThe command was running but exceeded the time limit.\n\nSuggestions:\n- Increase maxWaitTime parameter (currently: ${maxWaitTime}s)\n- Or use stopOnSuccess/stopOnError to exit early when pattern is found`;
        }
        return errorMsg;
      } else {
        return 'Command completed with no output';
      }
    } catch (error) {
      // Special handling for timeout errors
      if (error instanceof InvokeTimeoutError) {
        const timeoutSeconds = (error.timeout / 1000).toFixed(0);
        // 这是前端 IPC 超时，不是 Rust 端命令超时
        return `Error: IPC communication timeout (frontend waited ${timeoutSeconds}s, command maxWaitTime: ${maxWaitTime}s).\n\nPossible causes:\n1. Network connection to server lost\n2. SSH connection hang (no response)\n3. Rust backend is stuck or unresponsive\n\nThis is NOT a command execution timeout - the communication channel itself timed out.\n\nSuggestions:\n- Check if the server is still reachable\n- Try reconnecting the SSH session\n- Or check the backend logs for details`;
      }

      // Other errors remain as-is
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * 工具注册表
 */
export const toolRegistry = {
  listSSHServers,
  executeCommand,
  calculateExpression,
  getCurrentTime,
};

export type ToolName = keyof typeof toolRegistry;
