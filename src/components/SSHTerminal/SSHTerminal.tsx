/**
 * SSHTerminal 组件
 *
 * SSH 终端组件，集成 XtermTerminal 和 SSH 连接
 */

import { useRef, forwardRef, useImperativeHandle, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Activity, UploadCloud } from 'lucide-react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { XtermTerminal } from '../XtermTerminal/XtermTerminal';
import type { XtermTerminalRef } from '../XtermTerminal/XtermTerminal.types';
import { useSSHConnection } from '../../hooks/useSSHConnection';
import type {
  SSHTerminalProps,
  SSHTerminalRef,
  SSHConnectionStatus,
} from './SSHTerminal.types';
import { delay } from '../../utils/functionTools';
import { useSFTPSheetControl } from '../SFTPSheet/SFTPSheet';
import { getPassword } from 'tauri-plugin-keyring-api';
import { sshGetKeyPassphrase, sftpGetCwd, sftpFileExists } from '../../command';
import { MONITOR_WINDOW_CONFIG } from '../../config/window';
import { useSFTPSheet } from '../../store/sftpStore';
import { createIdempotentListenerManager } from '../../utils/idempotentListenerManager';
import { Dialog, type DialogRef } from '../Dialog';
import { UploadIndicator } from '../UploadIndicator';
import './SSHTerminal.css';

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * SSHTerminal 组件
 */
export const SSHTerminal = forwardRef<SSHTerminalRef, SSHTerminalProps>(({
  sessionId,
  host,
  port = 22,
  username,
  password,
  privateKeyPath,
  autoConnect = true,
  onStatusChange,
  onError,
  disconnectOnUnmount = true,
}, ref) => {
  // 国际化
  const { t } = useTranslation();

  // SFTP Sheet 控制
  const sftpSheet = useSFTPSheetControl();

  // 终端引用和容器引用
  const terminalRef = useRef<XtermTerminalRef | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 内部状态
  const [internalStatus, setInternalStatus] = useState<SSHConnectionStatus>('disconnected');
  const [internalError, setInternalError] = useState<string | null>(null);

  // 拖放上传状态
  const [isDragActive, setIsDragActive] = useState(false);
  const dialogRef = useRef<DialogRef>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // SFTP Store（用于上传）
  const { uploadFilesToPath } = useSFTPSheet();

  // 拖放监听器管理器（幂等）
  const dragDropListenerManager = useMemo(() => createIdempotentListenerManager(), []);

  // 状态映射配置（使用 useMemo 确保翻译响应式更新）
  const STATUS_MAP = useMemo<Record<SSHConnectionStatus, { className: string; text: string; dotClass: string }>>(() => ({
    disconnected: {
      className: '',
      text: t('terminal.status.disconnected'),
      dotClass: 'ssh-terminal__status-dot--disconnected',
    },
    connecting: {
      className: 'ssh-terminal--connecting',
      text: t('terminal.status.connecting'),
      dotClass: 'ssh-terminal__status-dot--connecting',
    },
    connected: {
      className: 'ssh-terminal--connected',
      text: t('terminal.status.connected'),
      dotClass: 'ssh-terminal__status-dot--connected',
    },
    reconnecting: {
      className: 'ssh-terminal--reconnecting',
      text: t('terminal.status.reconnecting'),
      dotClass: 'ssh-terminal__status-dot--reconnecting',
    },
    stale: {
      className: 'ssh-terminal--stale',
      text: t('terminal.status.stale', 'Connection Stale'),
      dotClass: 'ssh-terminal__status-dot--stale',
    },
    error: {
      className: 'ssh-terminal--error',
      text: t('terminal.status.error'),
      dotClass: 'ssh-terminal__status-dot--error',
    },
  }), [t]);

  // 使用 useRef 存储父组件回调，避免依赖变化
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // 使用 useCallback 包装回调，避免重复注册监听器（空依赖数组）
  const handleData = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const handleStatusChange = useCallback((status: SSHConnectionStatus) => {
    setInternalStatus(status);
    onStatusChangeRef.current?.(status);
  }, []); // 空依赖数组

  const handleError = useCallback((error: string) => {
    setInternalError(error);
    onErrorRef.current?.(error);
  }, []); // 空依赖数组

  // SSH 连接 Hook
  const sshConnection = useSSHConnection({
    sessionId,
    host,
    port,
    username,
    password,
    privateKeyPath,
    onData: handleData,
    onStatusChange: handleStatusChange,
    onError: handleError,
  });

  // 使用 ref 存储最新的方法，避免 useEffect 依赖变化导致重复 cleanup
  const writeRef = useRef(sshConnection.write);
  const connectRef = useRef(sshConnection.connect);
  const disconnectRef = useRef(sshConnection.disconnect);
  const isConnectedRef = useRef(sshConnection.isConnected);

  useEffect(() => {
    writeRef.current = sshConnection.write;
    connectRef.current = sshConnection.connect;
    disconnectRef.current = sshConnection.disconnect;
    isConnectedRef.current = sshConnection.isConnected;
  }); // 空依赖数组，每次渲染都更新 ref，但不触发 effect

  // 处理终端数据输入
  const handleTerminalData = useCallback(async (data: string) => {
    if (!data || data.length === 0) return;

    // 断开状态下按 Enter 键自动重连
    if ((internalStatus === 'disconnected' || internalStatus === 'error') && data === '\r') {
      try {
        await sshConnection.reconnect();
        await delay(100);
        terminalRef.current?.focus();
      } catch (e) {
        console.error('[SSHTerminal] Auto-reconnect failed:', e);
      }
      return;
    }

    try {
      await writeRef.current(data);
    } catch (e) {
      // 写入失败，等待用户按 Enter 键重连
      console.error('[SSHTerminal] Write failed:', e);
    }
  }, [internalStatus, sshConnection.reconnect]);

  // 暴露给父组件的方法（使用 ref 保持稳定）
  useImperativeHandle(ref, () => ({
    terminal: terminalRef.current,
    status: internalStatus,
    connect: connectRef.current,
    disconnect: disconnectRef.current,
    reconnect: sshConnection.reconnect,
    write: writeRef.current,
  }), [internalStatus]); // 只依赖 status，其他使用 ref

  // 使用 ref 追踪是否已尝试连接，避免重复连接
  const connectAttemptedRef = useRef(false);

  // 自动连接（只在挂载时执行一次，使用 ref 避免依赖变化）
  useEffect(() => {
    if (autoConnect && !connectAttemptedRef.current) {
      connectAttemptedRef.current = true;
      connectRef.current().catch(console.error);
    }

    // 清理时断开连接
    return () => {
      // 使用 ref 检查连接状态
      if (disconnectOnUnmount && isConnectedRef.current) {
        disconnectRef.current().catch(console.error);
      }
    };
  }, [autoConnect]); // 只依赖 autoConnect，其他都使用 ref

  // 监听终端尺寸变化，同步到 SSH 服务器
  useEffect(() => {
    if (internalStatus !== 'connected' || !containerRef.current) {
      return;
    }

    // 调整终端尺寸的函数（使用 ref）
    const handleResize = () => {
      const terminal = terminalRef.current?.getTerminal();
      if (!terminal) return;

      const dims = { cols: terminal.cols, rows: terminal.rows };
      sshConnection.resize(dims.cols, dims.rows).catch(console.error);
    };

    // 防抖的 resize 处理
    const debouncedResize = debounce(handleResize, 100);

    // 初始调整
    // 延迟一点以确保终端已完全初始化
    const initialTimer = setTimeout(() => {
      handleResize();
    }, 100);

    // 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      debouncedResize();
    });

    resizeObserver.observe(containerRef.current!);

    return () => {
      clearTimeout(initialTimer);
      resizeObserver.disconnect();
    };
  }, [internalStatus]);

  // 初始化进度监听器（用于上传进度更新）
  useEffect(() => {
    if (internalStatus !== 'connected') {
      return;
    }

    // 获取初始化函数
    const initProgressListenersForSession = useSFTPSheet.getState().initProgressListenersForSession;
    const cleanup = initProgressListenersForSession(sessionId);

    return () => {
      cleanup?.();
    };
  }, [internalStatus, sessionId]);

  // 构建SFTP配置的辅助函数（异步，从 keyring 获取凭据）
  const buildSFTPConfig = useCallback(async () => {
    if (privateKeyPath) {
      try {
        const keyPassphrase = await sshGetKeyPassphrase(privateKeyPath);
        const finalPassphrase = (!keyPassphrase || keyPassphrase === '') ? '<none>' : keyPassphrase;
        return {
          host,
          port,
          username,
          privateKeyPath,
          keyPassphrase: finalPassphrase,
        };
      } catch (e) {
        console.error('[SSHTerminal] Failed to get key passphrase:', e);
        return {
          host,
          port,
          username,
          privateKeyPath,
          keyPassphrase: '<none>',
        };
      }
    } else {
      let pwd = password;
      if (!pwd) {
        try {
          pwd = await getPassword(`ssh:${username}@${host}`, username) || undefined;
        } catch {
          // Password not found in keyring
        }
      }
      if (!pwd) {
        throw new Error('No credentials provided');
      }
      return {
        host,
        port,
        username,
        password: pwd,
      };
    }
  }, [host, port, username, privateKeyPath, password]);

  // 检查拖放位置是否在终端区域内
  const isOverDropzone = useCallback((position: { x: number; y: number }) => {
    if (!dropzoneRef.current) return false;
    const rect = dropzoneRef.current.getBoundingClientRect();
    return (
      position.x >= rect.left &&
      position.x <= rect.right &&
      position.y >= rect.top &&
      position.y <= rect.bottom
    );
  }, []);

  // 处理拖放上传
  const handleDragDrop = useCallback(async (files: File[]) => {
    if (internalStatus !== 'connected') {
      return;
    }

    try {
      // 获取 SFTP 配置（从 keyring 获取凭据）
      const sftpConfig = await buildSFTPConfig();
      // 获取远程当前工作目录
      const remoteCwd = await sftpGetCwd(sessionId, sftpConfig);

      // 检查同名文件并收集需要上传的文件
      const filesToUpload: File[] = [];
      const filesToConfirm: { file: File; remotePath: string }[] = [];

      for (const file of files) {
        const remotePath = remoteCwd === '/' ? `/${file.name}` : `${remoteCwd}/${file.name}`;
        const exists = await sftpFileExists(sessionId, sftpConfig, remotePath);

        if (exists) {
          filesToConfirm.push({ file, remotePath });
        } else {
          filesToUpload.push(file);
        }
      }

      // 处理需要确认的文件
      for (const { file } of filesToConfirm) {
        const shouldOverwrite = await new Promise<boolean>((resolve) => {
          dialogRef.current?.confirm({
            title: t('terminal.dragDrop.overwriteTitle', 'File Already Exists'),
            message: t(
              'terminal.dragDrop.overwriteMessage',
              `File "${file.name}" already exists in the remote directory. Do you want to overwrite it?`
            ),
            confirmText: t('common.buttons.overwrite', 'Overwrite'),
            cancelText: t('common.buttons.skip', 'Skip'),
            type: 'warning',
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

        if (shouldOverwrite) {
          filesToUpload.push(file);
        }
      }

      // 执行上传
      if (filesToUpload.length > 0) {
        await uploadFilesToPath(filesToUpload, remoteCwd, sessionId, sftpConfig);
      }
    } catch (error) {
      console.error('[SSHTerminal] Drag-drop upload failed:', error);
    }
  }, [internalStatus, sessionId, buildSFTPConfig, uploadFilesToPath, t]);

  // 拖放事件监听
  useEffect(() => {
    if (internalStatus !== 'connected') {
      return;
    }

    const manager = dragDropListenerManager;

    manager.register('drag-drop', async () => {
      const [unlistenDragOver, unlistenDragDrop, unlistenDragLeave] = await Promise.all([
        listen<{ position: { x: number; y: number } }>('tauri://drag-over', (event) => {
          if (isOverDropzone(event.payload.position)) {
            setIsDragActive(true);
          }
        }),
        listen<{ paths: string[]; position: { x: number; y: number } }>('tauri://drag-drop', async (event) => {
          setIsDragActive(false);

          if (!isOverDropzone(event.payload.position)) {
            return;
          }

          // 将路径转换为 File 对象
          const files = event.payload.paths.map(path => {
            // 在 Tauri 中，可以通过路径创建 File 对象
            // @ts-ignore - Tauri 特有属性
            return { name: path.split('/').pop() || path, path, size: 0 } as File;
          }).filter(Boolean);

          if (files.length > 0) {
            await handleDragDrop(files);
          }
        }),
        listen<void>('tauri://drag-leave', () => {
          setIsDragActive(false);
        }),
      ]);

      return () => {
        unlistenDragOver();
        unlistenDragDrop();
        unlistenDragLeave();
      };
    });

    return () => {
      manager.cleanup('drag-drop');
    };
  }, [internalStatus, isOverDropzone, handleDragDrop, dragDropListenerManager]);

  // 获取当前状态配置
  const statusConfig = useMemo(() => STATUS_MAP[internalStatus], [internalStatus]);

  // 打开监控窗口
  const openMonitorWindow = useCallback(async () => {
    const windowLabel = `monitor-${sessionId}`;

    const existingWindow = await WebviewWindow.getByLabel(windowLabel);
    if (existingWindow) {
      await existingWindow.show();
      await existingWindow.setFocus();
      await existingWindow.setAlwaysOnTop(true);
      await existingWindow.setAlwaysOnTop(false);
      return;
    }

    const mainWindow = getCurrentWindow();
    const mainPosition = await mainWindow.outerPosition();
    const mainSize = await mainWindow.outerSize();

    const monitorX = mainPosition.x + (mainSize.width - MONITOR_WINDOW_CONFIG.width) / 2;
    const monitorY = mainPosition.y + (mainSize.height - MONITOR_WINDOW_CONFIG.height) / 2;

    const params = new URLSearchParams({
      sessionId,
      host,
      port: String(port),
      username,
      ...(privateKeyPath ? { privateKeyPath } : {}),
    });

    new WebviewWindow(windowLabel, {
      url: `/monitor?${params.toString()}`,
      title: `Monitor - ${username}@${host}`,
      width: MONITOR_WINDOW_CONFIG.width,
      height: MONITOR_WINDOW_CONFIG.height,
      minWidth: MONITOR_WINDOW_CONFIG.minWidth,
      minHeight: MONITOR_WINDOW_CONFIG.minHeight,
      x: monitorX,
      y: monitorY,
      resizable: MONITOR_WINDOW_CONFIG.resizable,
      decorations: MONITOR_WINDOW_CONFIG.decorations,
      visible: false,
    });
  }, [sessionId, host, port, username, privateKeyPath]);

  return (
    <div className={`ssh-terminal ${statusConfig.className}`}>
      {/* 连接状态指示器 */}
      {(internalStatus === 'connecting' || internalStatus === 'error' || internalError) && (
        <div className="ssh-terminal__status">
          {internalStatus === 'connecting' && (
            <div className="ssh-terminal__status-indicator ssh-terminal__status-indicator--connecting">
              <div className="ssh-terminal__spinner" />
              <span>Connecting to {username}@{host}:{port}...</span>
            </div>
          )}
          {internalStatus === 'error' && (
            <div className="ssh-terminal__status-indicator ssh-terminal__status-indicator--error">
              <span className="ssh-terminal__error-icon">⚠</span>
              <span className="ssh-terminal__error-message">
                {internalError || 'Connection failed'}
              </span>
              <button
                className="ssh-terminal__retry-button"
                onClick={() => sshConnection.reconnect()}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* 终端 */}
      <div className="ssh-terminal__content" ref={containerRef}>
        <div ref={dropzoneRef} className="ssh-terminal__dropzone">
          <XtermTerminal
            ref={terminalRef}
            onData={handleTerminalData}
            localEcho={false}
          />
          {/* 拖放覆盖层 */}
          {isDragActive && (
            <div className="ssh-terminal__drag-overlay">
              <UploadCloud size={48} />
              <span>{t('terminal.dragDrop.dropToUpload', 'Drop files to upload to remote directory')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 确认对话框 */}
      <Dialog ref={dialogRef} />

      {/* 底部状态栏 */}
      <div className="ssh-terminal__footer">
        <span className="ssh-terminal__connection-info">
          <span className={`ssh-terminal__status-dot ${statusConfig.dotClass}`} />
          <span className="ssh-terminal__status-text">{statusConfig.text}</span>
          <span className="ssh-terminal__connection-target">{username}@{host}:{port}</span>
          {/* Upload indicator (progress/success/error) */}
          {internalStatus === 'connected' && (
            <UploadIndicator sessionId={sessionId} />
          )}
        </span>
        {/* 状态栏按钮 */}
        <div className="ssh-terminal__footer-actions">
          {internalStatus === 'connected' && (
            <button
              className="ssh-terminal__footer-button ssh-terminal__dashboard-button"
              onClick={openMonitorWindow}
              title={t('monitor.buttons.dashboardTooltip')}
              aria-label={t('monitor.buttons.dashboardTooltip')}
            >
              <Activity size={14} />
              {t('monitor.buttons.dashboard')}
            </button>
          )}
          {internalStatus === 'connected' && (
            <button
              className="ssh-terminal__footer-button ssh-terminal__sftp-button"
              onClick={async () => {
                if (privateKeyPath) {
                  try {
                    const keyPassphrase = await sshGetKeyPassphrase(privateKeyPath);
                    const finalPassphrase = (!keyPassphrase || keyPassphrase === '') ? '<none>' : keyPassphrase;
                    sftpSheet.open(sessionId, {
                      host,
                      port,
                      username,
                      privateKeyPath,
                      keyPassphrase: finalPassphrase,
                    });
                  } catch (e) {
                    alert('Key passphrase required. Please ensure your key passphrase is saved in the keychain.');
                  }
                } else {
                  let pwd = password;
                  if (!pwd) {
                    try {
                      pwd = await getPassword(`ssh:${username}@${host}`, username) || undefined;
                    } catch {
                      // Password not found in keyring
                    }
                  }
                  if (pwd) {
                    sftpSheet.open(sessionId, {
                      host,
                      port,
                      username,
                      password: pwd,
                    });
                  }
                }
              }}
              title={t('terminal.buttons.openSFTP')}
              aria-label={t('terminal.buttons.openSFTP')}
            >
              <HardDrive size={14} />
              {t('terminal.buttons.sftp')}
            </button>
          )}
          {internalStatus === 'connected' && (
            <button
              className="ssh-terminal__footer-button ssh-terminal__disconnect-button"
              onClick={() => sshConnection.disconnect()}
              title={t('terminal.buttons.disconnectTooltip')}
            >
              {t('terminal.buttons.disconnect')}
            </button>
          )}
          {(internalStatus === 'disconnected' || internalStatus === 'error' || internalStatus === 'reconnecting') && (
            <button
              className="ssh-terminal__footer-button ssh-terminal__reconnect-button"
              onClick={() => sshConnection.reconnect()}
              title={t('terminal.buttons.reconnectTooltip')}
              disabled={internalStatus === 'reconnecting'}
            >
              {internalStatus === 'reconnecting' ? t('terminal.buttons.reconnecting') : t('terminal.buttons.reconnect')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

SSHTerminal.displayName = 'SSHTerminal';

export default SSHTerminal;
