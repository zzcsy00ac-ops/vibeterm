/**
 * SSH 连接 Hook
 *
 * 管理 SSH 连接状态、数据传输和终端尺寸同步
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getPassword } from 'tauri-plugin-keyring-api';
import { sshConnect, sshWrite, sshResize, sshClose, sshGetKeyPassphrase, type SSHConnectConfig } from '../command';
import { showPasswordPrompt } from '../components/SSHPasswordPrompt/SSHPasswordPrompt';
import { showKeyPassphrasePrompt } from '../components/KeyPassphrasePrompt/KeyPassphrasePrompt';

/**
 * 连接状态
 */
export type SSHConnectionStatus =
  | 'disconnected'   // 未连接
  | 'connecting'     // 连接中
  | 'connected'      // 已连接
  | 'reconnecting'   // 重连中
  | 'stale'          // 连接超时（可能已断开）
  | 'error';         // 错误

/**
 * SSH 连接 Hook 配置
 */
export interface UseSSHConnectionOptions {
  /** 会话 ID */
  sessionId: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port?: number;
  /** 用户名 */
  username: string;
  /** 密码（可选，如果使用私钥认证则不需要） */
  password?: string;
  /** 私钥文件路径（可选，如果使用密码认证则不需要） */
  privateKeyPath?: string;
  /** 终端列数 */
  cols?: number;
  /** 终端行数 */
  rows?: number;
  /** Keepalive 间隔（毫秒，默认 30000） */
  keepaliveInterval?: number;
  /** 判定连接超时的阈值（毫秒，默认 300000 = 5分钟） */
  staleThreshold?: number;
  /** 是否启用自动重连（默认 true） */
  autoReconnect?: boolean;
  /** 最大重连次数（默认 3） */
  maxReconnectAttempts?: number;
  /** 重连基础延迟（毫秒，默认 2000，使用指数退避） */
  reconnectDelay?: number;
  /** 接收数据回调 */
  onData?: (data: string) => void;
  /** 连接状态变化回调 */
  onStatusChange?: (status: SSHConnectionStatus) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

/**
 * SSH 连接 Hook 返回值
 */
export interface UseSSHConnectionReturn {
  /** 连接状态 */
  status: SSHConnectionStatus;
  /** 错误信息 */
  error: string | null;
  /** 是否正在连接 */
  isConnecting: boolean;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在重连 */
  isReconnecting: boolean;
  /** 是否连接超时（可能已断开） */
  isStale: boolean;
  /** 连接 */
  connect: () => Promise<void>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 重连 */
  reconnect: () => Promise<void>;
  /** 写入数据 */
  write: (data: string) => Promise<void>;
  /** 调整终端尺寸 */
  resize: (cols: number, rows: number) => Promise<void>;
}

/**
 * SSH 连接 Hook
 */
export function useSSHConnection(
  options: UseSSHConnectionOptions
): UseSSHConnectionReturn {
  const {
    sessionId,
    host,
    port = 22,
    username,
    password: initialPassword,
    privateKeyPath,
    cols = 80,
    rows = 24,
    keepaliveInterval = 30000, // 默认 30 秒
    staleThreshold = 300000, // 默认 5 分钟
    autoReconnect = true, // 默认启用自动重连
    maxReconnectAttempts = 3, // 默认最大重连 3 次
    reconnectDelay = 2000, // 默认 2 秒
    onData,
    onStatusChange,
    onError,
  } = options;

  // 状态
  const [status, setStatus] = useState<SSHConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 存储回调，确保依赖数组稳定
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const onDataRef = useRef(onData);

  // 最后活动时间（用于健康检查）
  const lastActivityTimeRef = useRef<number>(Date.now());

  // 重连计数器
  const reconnectAttemptsRef = useRef<number>(0);

  // 更新 ref 当回调变化时
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onErrorRef.current = onError;
    onDataRef.current = onData;
  }, [onStatusChange, onError, onData]);

  // 生成密钥链服务名（不使用 sessionId，以便与 PasswordField 保持一致）
  const getServiceName = useCallback(() => {
    return `ssh:${username}@${host}`;
  }, [host, username]);

  // 连接
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      onStatusChangeRef.current?.('connecting');

      let password = initialPassword;
      let keyPassphrase: string | undefined;

      // 如果使用私钥认证，尝试获取密码短语
      if (privateKeyPath) {
        try {
          const savedPassphrase = await sshGetKeyPassphrase(privateKeyPath);
          if (savedPassphrase) {
            keyPassphrase = savedPassphrase;
            console.log('[useSSHConnection] Found saved passphrase for key:', privateKeyPath);
          } else {
            console.log('[useSSHConnection] No saved passphrase found for key:', privateKeyPath);
          }
        } catch (e) {
          // Keychain 中没有密码短语
          console.log('[useSSHConnection] Failed to get passphrase from keychain:', e);
        }
      } else {
        // 如果使用密码认证，尝试从 Keychain 获取密码
        if (!password) {
          try {
            const service = getServiceName();
            const savedPassword = await getPassword(service, username);
            if (savedPassword) {
              password = savedPassword;
            }
          } catch {
            // Keychain 中没有密码
          }
        }
      }

      // 如果仍然没有凭据，显示提示对话框
      if (!password && !privateKeyPath) {
        const result = await showPasswordPrompt({
          username,
          host,
          onSubmit: () => {},
          onCancel: () => {
            throw new Error('Password prompt cancelled');
          },
        });

        if (!result) {
          throw new Error('Password required');
        }

        password = result.password;
        // 密码已在对话框中保存到 Keychain（如果用户选择保存）
      }

      const config: SSHConnectConfig = {
        session_id: sessionId,
        host,
        port,
        username,
        password,
        private_key_path: privateKeyPath,
        key_passphrase: keyPassphrase,
        cols,
        rows,
      };

      console.log('[useSSHConnection] Connecting with config:', {
        host,
        port,
        username,
        hasPassword: !!password,
        privateKeyPath,
        hasKeyPassphrase: !!keyPassphrase,
      });

      await sshConnect(config);

      setStatus('connected');
      onStatusChangeRef.current?.('connected');
      // 重置重连计数器
      reconnectAttemptsRef.current = 0;
      // 重置活动时间
      lastActivityTimeRef.current = Date.now();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus('error');
      onStatusChangeRef.current?.('error');
      onErrorRef.current?.(errorMessage);
    }
  }, [
    sessionId,
    host,
    port,
    username,
    initialPassword,
    privateKeyPath,
    cols,
    rows,
    getServiceName,
  ]);

  // 断开连接
  const disconnect = useCallback(async () => {
    try {
      await sshClose(sessionId);
      setStatus('disconnected');
      setError(null);
      onStatusChangeRef.current?.('disconnected');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
    }
  }, [sessionId]);

  // 重连
  const reconnect = useCallback(async () => {
    // 先断开旧连接（如果存在）
    try {
      await sshClose(sessionId);
    } catch {
      // 忽略断开错误，继续重连
    }

    // 重新连接
    await connect();
  }, [sessionId, connect]);

  // 写入数据
  const write = useCallback(async (data: string) => {
    try {
      await sshWrite(sessionId, data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      // "Operation cancelled" 不代表 SSH 连接断开，保持当前状态
      if (errorMessage !== 'Operation cancelled') {
        setStatus('disconnected');
        onStatusChangeRef.current?.('disconnected');
      }
      throw e;
    }
  }, [sessionId]);

  // 调整终端尺寸
  const resize = useCallback(async (newCols: number, newRows: number) => {
    if (status !== 'connected') {
      return;
    }
    await sshResize(sessionId, newCols, newRows);
  }, [sessionId, status]);

  // 监听后端事件
  useEffect(() => {
    // 使用 ref 来跟踪这个 effect 是否仍然有效
    const validRef = { current: true };

    // 存储所有 listener Promise
    const listenerPromises: Promise<UnlistenFn>[] = [];

    // 监听连接成功事件
    listenerPromises.push(
      listen(`ssh://connected/${sessionId}`, () => {
        if (!validRef.current) return;
        setStatus('connected');
        setError(null);
        onStatusChangeRef.current?.('connected');
      })
    );

    // 监听连接关闭事件
    listenerPromises.push(
      listen(`ssh://closed/${sessionId}`, () => {
        if (!validRef.current) return;
        setStatus('disconnected');
        onStatusChangeRef.current?.('disconnected');
      })
    );

    // 监听需要密码短语事件
    listenerPromises.push(
      listen(`ssh://need_passphrase/${sessionId}`, async (event) => {
        if (!validRef.current) return;
        const keyPath = event.payload as string;

        try {
          const result = await showKeyPassphrasePrompt({
            keyPath,
            onSubmit: () => {},
            onCancel: () => {
              throw new Error('Passphrase prompt cancelled');
            },
          });

          if (result) {
            // 用户输入了密码短语，重新连接
            await connect();
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          setError(errorMessage);
          setStatus('error');
          onStatusChangeRef.current?.('error');
          onErrorRef.current?.(errorMessage);
        }
      })
    );

    // 监听连接错误事件
    listenerPromises.push(
      listen(`ssh://error/${sessionId}`, (event) => {
        if (!validRef.current) return;
        const errorMessage = event.payload as string;
        console.error('[useSSHConnection] SSH error event:', errorMessage);
        setError(errorMessage);
        setStatus('error');
        onStatusChangeRef.current?.('error');
        onErrorRef.current?.(errorMessage);
      })
    );

    // 监听数据事件（始终监听以更新活动时间）
    listenerPromises.push(
      listen(`ssh://data/${sessionId}`, (event) => {
        if (!validRef.current) return;
        // 更新最后活动时间
        lastActivityTimeRef.current = Date.now();
        // 调用数据回调
        onDataRef.current?.(event.payload as string);
      })
    );

    // cleanup 函数 - 等待所有 listener 注册完成后清理
    const cleanup = () => {
      // 标记这个 effect 为无效
      validRef.current = false;

      // 等待所有 listener Promise 完成，然后调用 unlisten
      Promise.all(listenerPromises).then((unlistenFns) => {
        unlistenFns.forEach((unlisten) => unlisten());
      });
    };

    return cleanup;
  }, [sessionId, connect]);

  // Keepalive 定时器 - 保持连接活跃
  useEffect(() => {
    if (status !== 'connected') return;

    const sendKeepalive = async () => {
      try {
        // 发送 SSH_MSG_IGNORE 保持连接活跃
        // 使用空数据包不会影响终端显示
        await sshWrite(sessionId, '');
      } catch (e) {
        console.warn('[useSSHConnection] Keepalive failed:', e);
      }
    };

    const intervalId = setInterval(sendKeepalive, keepaliveInterval);
    console.log(`[useSSHConnection] Keepalive started: interval=${keepaliveInterval}ms`);

    return () => {
      clearInterval(intervalId);
      console.log('[useSSHConnection] Keepalive stopped');
    };
  }, [status, sessionId, keepaliveInterval]);

  // 健康检查定时器 - 检测静默断开的连接
  useEffect(() => {
    if (status !== 'connected') return;

    const checkHealth = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;

      if (timeSinceLastActivity > staleThreshold) {
        console.warn(`[useSSHConnection] Connection stale: no activity for ${Math.round(timeSinceLastActivity / 1000)}s`);
        setStatus('stale');
        onStatusChangeRef.current?.('stale');
      }
    };

    // 每 60 秒检查一次健康状态
    const intervalId = setInterval(checkHealth, 60000);
    console.log(`[useSSHConnection] Health check started: staleThreshold=${staleThreshold}ms`);

    return () => {
      clearInterval(intervalId);
      console.log('[useSSHConnection] Health check stopped');
    };
  }, [status, staleThreshold]);

  // 自动重连机制
  useEffect(() => {
    if (!autoReconnect || status !== 'stale') return;

    const attemptReconnect = async () => {
      const attempts = reconnectAttemptsRef.current;

      if (attempts >= maxReconnectAttempts) {
        console.warn(`[useSSHConnection] Max reconnect attempts (${maxReconnectAttempts}) reached`);
        setStatus('error');
        onStatusChangeRef.current?.('error');
        setError(`Connection lost after ${maxReconnectAttempts} reconnect attempts`);
        return;
      }

      // 指数退避：每次重连延迟翻倍
      const delay = reconnectDelay * Math.pow(2, attempts);
      console.log(`[useSSHConnection] Auto-reconnect attempt ${attempts + 1}/${maxReconnectAttempts} in ${delay}ms`);

      reconnectAttemptsRef.current = attempts + 1;
      setStatus('reconnecting');
      onStatusChangeRef.current?.('reconnecting');

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        await connect();
      } catch (e) {
        console.error('[useSSHConnection] Auto-reconnect failed:', e);
        // 如果重连失败，状态会保持 stale，触发下一次重连尝试
        setStatus('stale');
      }
    };

    attemptReconnect();
  }, [status, autoReconnect, maxReconnectAttempts, reconnectDelay, connect]);

  return {
    status,
    error,
    isConnecting: status === 'connecting',
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    isStale: status === 'stale',
    connect,
    disconnect,
    reconnect,
    write,
    resize,
  };
}
