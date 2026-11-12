/**
 * SFTP 文件管理状态管理
 *
 * 使用 Zustand 管理 SFTP 面板的状态
 * 注意：此状态不持久化，与 SSH 会话相关
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createIdempotentListenerManager } from '../utils/idempotentListenerManager';

// ==================== 进度监听器管理器 ====================

/**
 * 全局进度监听器管理器
 * 使用幂等管理器确保每个 sessionId 只注册一次监听器
 */
const progressListenerManager = createIdempotentListenerManager();

// ==================== 类型定义 ====================

/**
 * SFTP 连接配置
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
function buildSFTPConfig(connectionConfig: SFTPConnectConfig) {
  return {
    host: connectionConfig.host,
    port: connectionConfig.port,
    username: connectionConfig.username,
    ...(connectionConfig.password && { password: connectionConfig.password }),
    ...(connectionConfig.privateKeyPath && { privateKeyPath: connectionConfig.privateKeyPath }),
    ...(connectionConfig.keyPassphrase && { keyPassphrase: connectionConfig.keyPassphrase }),
  };
}

/**
 * 会话状态 - 用于保存每个会话的 SFTP 状态
 */
export interface SessionState {
  /** 当前路径 */
  currentPath: string;
  /** 过滤文本 */
  filterText: string;
  /** 是否显示过滤栏 */
  showFilter: boolean;
  /** 最后打开时间 */
  lastOpenTime: number;
}

/**
 * SFTP 文件信息
 */
export interface SFTPFile {
  /** 文件名 */
  name: string;
  /** 完整路径 */
  fullPath: string;
  /** 是否目录 */
  isDirectory: boolean;
  /** 是否符号链接 */
  isSymlink: boolean;
  /** 文件大小（字节） */
  size: number;
  /** 权限模式 */
  mode: number;
  /** 修改时间（Unix 时间戳） */
  mtime: number;
}

/**
 * 面板状态
 */
export type SFTPSheetStatus = 'closed' | 'opening' | 'open' | 'error';

/**
 * 传输进度信息
 */
export interface TransferProgress {
  /** 文件路径 */
  path: string;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 是否完成 */
  completed: boolean;
}

/**
 * 上传完成事件 payload
 */
export interface UploadCompleteEvent {
  /** 文件路径 */
  path: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 上传任务状态
 */
export type UploadTaskStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';

/**
 * 上传任务
 */
export interface UploadTask {
  /** 任务 ID（唯一标识） */
  id: string;
  /** 所属的 SSH 会话 ID */
  sessionId: string;
  /** 连接配置（用于独立上传，不依赖面板状态） */
  connectionConfig?: SFTPConnectConfig;
  /** 文件名 */
  fileName: string;
  /** 远程路径 */
  remotePath: string;
  /** 本地路径（用于区分同名文件） */
  localPath: string;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 任务状态 */
  status: UploadTaskStatus;
  /** 错误信息（仅在 failed 状态时有值） */
  error?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 已上传字节数（用于断点续传） */
  uploadedBytes?: number;
  /** 文件总字节数（用于断点续传） */
  totalBytes?: number;
}

/**
 * 下载任务状态
 */
export type DownloadTaskStatus = 'downloading' | 'completed' | 'failed';

/**
 * 下载任务
 */
export interface DownloadTask {
  /** 任务 ID（唯一标识） */
  id: string;
  /** 所属的 SSH 会话 ID */
  sessionId: string;
  /** 文件名 */
  fileName: string;
  /** 远程路径 */
  remotePath: string;
  /** 本地保存路径 */
  localPath: string;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 任务状态 */
  status: DownloadTaskStatus;
  /** 错误信息（仅在 failed 状态时有值） */
  error?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 文件总字节数 */
  totalBytes: number;
}

/**
 * Upload summary for indicator display
 */
export interface UploadSummary {
  /** Total files being processed */
  total: number;
  /** Currently uploading count */
  uploading: number;
  /** Queued count */
  queued: number;
  /** Successfully completed count */
  completed: number;
  /** Failed count */
  failed: number;
  /** Current file being uploaded */
  currentFile: string;
  /** Overall progress 0-100 */
  progress: number;
  /** Aggregated status */
  status: 'idle' | 'uploading' | 'success' | 'partial-failure' | 'failed';
}

// ==================== Store 接口 ====================

interface SFTPSheetState {
  // ========== 多会话状态存储 ==========
  /** 存储每个会话的 SFTP 状态 */
  sessionStates: Record<string, SessionState>;

  // ========== 面板状态 ==========
  /** 面板是否打开 */
  isOpen: boolean;
  /** SSH 会话 ID */
  sessionId: string | null;
  /** SFTP 连接配置 */
  connectionConfig: SFTPConnectConfig | null;
  /** 当前路径 */
  currentPath: string;
  /** 面板状态 */
  status: SFTPSheetStatus;
  /** 错误信息 */
  error: string | null;

  // ========== 文件列表 ==========
  /** 文件列表 */
  files: SFTPFile[];
  /** 过滤后的文件列表 */
  filteredFiles: SFTPFile[];
  /** 是否正在加载 */
  isLoading: boolean;

  // ========== 过滤 ==========
  /** 是否显示过滤栏 */
  showFilter: boolean;
  /** 过滤文本 */
  filterText: string;

  // ========== 传输进度 ==========
  /** 上传进度 (文件路径 -> 进度信息) */
  uploadProgress: Record<string, TransferProgress>;
  /** 下载进度 (文件路径 -> 进度信息) */
  downloadProgress: Record<string, TransferProgress>;
  /** 上传完成监听器清理函数 */
  uploadCompleteUnlisten: (() => void) | null;

  // ========== 上传任务管理 ==========
  /** 上传任务列表 (任务 ID -> 任务信息) */
  uploadTasks: Map<string, UploadTask>;
  /** 上传任务计数器（用于生成唯一 ID） */
  uploadTaskCounter: number;
  /** 上传队列（等待开始上传的任务 ID 列表） */
  uploadQueue: string[];
  /** 当前活跃的上传数量 */
  activeUploads: number;
  /** 最大并发上传数 */
  maxConcurrentUploads: number;
  /** 上传优先级策略 */
  uploadPriority: 'small-first' | 'as-dropped';

  // ========== 下载任务管理 ==========
  /** 下载任务列表 (任务 ID -> 任务信息) */
  downloadTasks: Map<string, DownloadTask>;
  /** 下载任务计数器（用于生成唯一 ID） */
  downloadTaskCounter: number;

  // ========== Actions ==========

  /** 打开面板 */
  openSheet: (sessionId: string, connectionConfig: SFTPConnectConfig, initialPath?: string) => Promise<void>;
  /** 关闭面板 */
  closeSheet: () => void;
  /** 切换会话（不关闭面板） */
  switchSession: (sessionId: string, connectionConfig: SFTPConnectConfig) => Promise<void>;
  /** 获取会话状态 */
  getSessionState: (sessionId: string) => SessionState | null;
  /** 导航到路径 */
  navigate: (path: string) => Promise<void>;
  /** 返回上级目录 */
  goUp: () => Promise<void>;
  /** 刷新当前目录 */
  refresh: () => Promise<void>;

  /** 切换过滤栏 */
  toggleFilter: () => void;
  /** 设置过滤文本 */
  setFilterText: (text: string) => void;
  /** 应用过滤 */
  applyFilter: () => void;

  /** 上传文件 */
  uploadFiles: (files: File[]) => Promise<void>;
  /** 上传文件到指定路径 */
  uploadFilesToPath: (files: File[], targetPath: string, sessionId: string, connectionConfig: SFTPConnectConfig) => Promise<void>;
  /** 检查文件是否存在 */
  checkFileExists: (remotePath: string) => Promise<boolean>;
  /** 下载文件 */
  downloadFile: (file: SFTPFile) => Promise<void>;
  /** 创建目录 */
  createDirectory: (name: string) => Promise<void>;
  /** 删除项目 */
  deleteItem: (file: SFTPFile) => Promise<void>;
  /** 重命名项目 */
  renameItem: (file: SFTPFile, newName: string) => Promise<void>;

  /** 设置错误状态 */
  setError: (error: string | null) => void;

  /** 设置上传进度 */
  setUploadProgress: (path: string, progress: TransferProgress) => void;
  /** 设置下载进度 */
  setDownloadProgress: (path: string, progress: TransferProgress) => void;
  /** 清除上传进度 */
  clearUploadProgress: (path: string) => void;
  /** 清除下载进度 */
  clearDownloadProgress: (path: string) => void;
  /** 初始化进度监听 */
  initProgressListeners: () => (() => void) | undefined;
  /** 为指定会话初始化进度监听（用于终端拖放上传） */
  initProgressListenersForSession: (sessionId: string) => (() => void) | undefined;

  // ========== 上传任务管理 Actions ==========

  /** 添加上传任务 */
  addUploadTask: (task: UploadTask) => void;
  /** 更新上传任务 */
  updateUploadTask: (id: string, updates: Partial<UploadTask>) => void;
  /** 删除上传任务 */
  removeUploadTask: (id: string) => void;
  /** 清除已完成的任务 */
  clearCompletedTasks: () => void;
  /** 取消上传任务 */
  cancelUpload: (taskId: string) => Promise<void>;
  /** 处理上传队列 */
  processUploadQueue: () => void;
  /** 重试上传（支持断点续传） */
  retryUpload: (taskId: string, resume: boolean) => Promise<void>;

  // ========== 下载任务管理 Actions ==========

  /** 添加下载任务 */
  addDownloadTask: (task: DownloadTask) => void;
  /** 更新下载任务 */
  updateDownloadTask: (id: string, updates: Partial<DownloadTask>) => void;
  /** 删除下载任务 */
  removeDownloadTask: (id: string) => void;
  /** 清除已完成的下载任务 */
  clearCompletedDownloads: () => void;

  /** Get upload summary for a session */
  getUploadSummary: (sessionId: string) => UploadSummary;
}

// ==================== 工具函数 ====================

/**
 * 排序文件列表：目录优先，然后字母序
 */
function sortFiles(files: SFTPFile[]): SFTPFile[] {
  return files.sort((a, b) => {
    // 目录优先
    const dirCompare = Number(b.isDirectory) - Number(a.isDirectory);
    if (dirCompare !== 0) return dirCompare;

    // 字母序
    return a.name.localeCompare(b.name);
  });
}

// ==================== 创建 Store ====================

export const useSFTPSheet = create<SFTPSheetState>((set, get) => ({
  // ========== 初始状态 ==========
  sessionStates: {},
  isOpen: false,
  sessionId: null,
  connectionConfig: null,
  currentPath: '/',
  status: 'closed',
  error: null,
  files: [],
  filteredFiles: [],
  isLoading: false,
  showFilter: false,
  filterText: '',
  uploadProgress: {},
  downloadProgress: {},
  uploadCompleteUnlisten: null,
  uploadTasks: new Map(),
  uploadTaskCounter: 0,
  uploadQueue: [],
  activeUploads: 0,
  maxConcurrentUploads: 3,
  uploadPriority: 'as-dropped',
  downloadTasks: new Map(),
  downloadTaskCounter: 0,

  // ========== Actions ==========

  /**
   * 打开面板
   * 打开前保存当前会话状态，打开后恢复新会话的保存状态（如果有）
   */
  openSheet: async (sessionId: string, connectionConfig: SFTPConnectConfig, initialPath = '/') => {
    const { sessionId: currentSessionId, currentPath, filterText, showFilter } = get();

    // 保存当前会话的状态
    if (currentSessionId && currentSessionId !== sessionId) {
      set((state) => ({
        sessionStates: {
          ...state.sessionStates,
          [currentSessionId]: {
            currentPath,
            filterText,
            showFilter,
            lastOpenTime: Date.now(),
          },
        },
      }));
    }

    // 恢复新会话的状态（如果存在）
    const savedState = get().sessionStates[sessionId];
    const restorePath = savedState?.currentPath || initialPath;

    set({
      isOpen: true,
      sessionId,
      connectionConfig,
      currentPath: restorePath,
      status: 'opening',
      error: null,
      // 恢复过滤状态
      filterText: savedState?.filterText || '',
      showFilter: savedState?.showFilter || false,
    });

    try {
      await get().navigate(restorePath);
      set({ status: 'open' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * 关闭面板
   * 关闭前保存当前会话的状态
   */
  closeSheet: () => {
    const { sessionId, currentPath, filterText, showFilter } = get();

    // 保存当前会话状态
    if (sessionId) {
      set((state) => ({
        sessionStates: {
          ...state.sessionStates,
          [sessionId]: {
            currentPath,
            filterText,
            showFilter,
            lastOpenTime: Date.now(),
          },
        },
      }));
    }

    // 清理上传完成监听器
    get().uploadCompleteUnlisten?.();

    set({
      isOpen: false,
      sessionId: null,
      connectionConfig: null,
      currentPath: '/',
      status: 'closed',
      error: null,
      files: [],
      filteredFiles: [],
      isLoading: false,
      filterText: '',
      showFilter: false,
      uploadCompleteUnlisten: null,
      // 注意：不清理 uploadTasks、uploadProgress、downloadProgress
      // 这样重新打开面板时可以看到之前的传输状态
    });
  },

  /**
   * 导航到指定路径
   */
  navigate: async (path: string) => {
    const { sessionId, connectionConfig } = get();

    if (!sessionId || !connectionConfig) {
      throw new Error('No active SSH session or connection config');
    }

    set({ isLoading: true, currentPath: path, error: null });

    try {
      const files = await invoke<SFTPFile[]>('sftp_list_dir', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        path,
      });

      // 排序文件列表
      const sortedFiles = sortFiles(files);

      set({
        files: sortedFiles,
        filteredFiles: sortedFiles,
        isLoading: false,
      });

      // 应用当前过滤条件
      get().applyFilter();
    } catch (error) {
      console.error('[sftpStore] navigate error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * 返回上级目录
   */
  goUp: async () => {
    const { currentPath } = get();

    // 如果已在根目录，无法返回
    if (currentPath === '/' || currentPath === '') {
      return;
    }

    // 获取父目录路径
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop(); // 移除最后一段
    const parentPath = segments.length > 0 ? `/${segments.join('/')}` : '/';

    await get().navigate(parentPath);
  },

  /**
   * 刷新当前目录
   */
  refresh: async () => {
    const { currentPath } = get();
    await get().navigate(currentPath);
  },

  /**
   * 切换会话（不关闭面板）
   * 保存当前会话状态，然后切换到新会话并恢复其状态
   */
  switchSession: async (sessionId: string, connectionConfig: SFTPConnectConfig) => {
    const { isOpen, sessionId: currentSessionId } = get();

    if (!isOpen) {
      // 如果面板未打开，直接打开
      return get().openSheet(sessionId, connectionConfig);
    }

    // 保存当前会话状态
    if (currentSessionId && currentSessionId !== sessionId) {
      const { currentPath, filterText, showFilter } = get();
      set((state) => ({
        sessionStates: {
          ...state.sessionStates,
          [currentSessionId]: {
            currentPath,
            filterText,
            showFilter,
            lastOpenTime: Date.now(),
          },
        },
      }));
    }

    // 恢复新会话状态
    const savedState = get().sessionStates[sessionId];
    const restorePath = savedState?.currentPath || '/';

    set({
      sessionId,
      connectionConfig,
      currentPath: restorePath,
      filterText: savedState?.filterText || '',
      showFilter: savedState?.showFilter || false,
      status: 'opening',
    });

    await get().navigate(restorePath);
    set({ status: 'open' });
  },

  /**
   * 获取会话状态
   */
  getSessionState: (sessionId: string) => {
    return get().sessionStates[sessionId] || null;
  },

  /**
   * 切换过滤栏显示
   */
  toggleFilter: () => {
    set((state) => ({ showFilter: !state.showFilter }));

    // 如果关闭过滤栏，清除过滤文本
    if (!get().showFilter) {
      get().setFilterText('');
    }
  },

  /**
   * 设置过滤文本
   */
  setFilterText: (text: string) => {
    set({ filterText: text });
    get().applyFilter();
  },

  /**
   * 应用文件过滤
   */
  applyFilter: () => {
    const { files, filterText, showFilter } = get();

    // 如果未显示过滤栏或过滤文本为空，显示所有文件
    if (!showFilter || !filterText.trim()) {
      set({ filteredFiles: files });
      return;
    }

    // 过滤文件名（大小写不敏感）
    const filtered = files.filter((file) =>
      file.name.toLowerCase().includes(filterText.toLowerCase())
    );

    set({ filteredFiles: filtered });
  },

  /**
   * 检查远程文件是否存在
   */
  checkFileExists: async (remotePath: string) => {
    const { sessionId, connectionConfig } = get();

    if (!sessionId || !connectionConfig) {
      return false;
    }

    try {
      const exists = await invoke<boolean>('sftp_file_exists', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        path: remotePath,
      });
      return exists;
    } catch (error) {
      return false;
    }
  },

  /**
   * 上传文件（队列管理 + 并发控制 + 优先级排序）
   */
  uploadFiles: async (files: File[]) => {
    const { sessionId, connectionConfig, currentPath, uploadPriority } = get();

    if (!sessionId || !connectionConfig) {
      console.error('[sftpStore] No active SSH session or connection config');
      throw new Error('No active SSH session or connection config');
    }

    // 根据优先级策略排序文件
    let sortedFiles = [...files];
    if (uploadPriority === 'small-first') {
      sortedFiles.sort((a, b) => {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        return sizeA - sizeB; // 小文件优先
      });
    }

    // 创建任务并添加到队列（不立即启动上传）
    const taskIds: string[] = [];
    sortedFiles.forEach(file => {
      try {
        // 在 Tauri 中，File 对象有 path 属性
        // @ts-ignore - Tauri File 对象有 path 属性
        const localPath = file.path || file.name;

        const remotePath = currentPath === '/'
          ? `/${file.name}`
          : `${currentPath}/${file.name}`;

        // 生成唯一任务 ID（使用计数器确保唯一性）
        const counter = get().uploadTaskCounter + 1;
        set({ uploadTaskCounter: counter });
        const taskId = `task-${counter}-${Date.now()}`;
        taskIds.push(taskId);

        // 添加任务到 uploadTasks
        get().addUploadTask({
          id: taskId,
          sessionId,  // 添加 sessionId 关联
          connectionConfig,
          fileName: file.name,
          remotePath,
          localPath,
          progress: 0,
          status: 'pending',
          createdAt: Date.now(),
          totalBytes: file.size || 0,
        });
      } catch (error) {
        console.error(`[sftpStore] Error creating task for ${file.name}:`, error);
      }
    });

    // 将新任务 ID 添加到队列
    set((state) => ({
      uploadQueue: [...state.uploadQueue, ...taskIds],
    }));

    // 设置完成监听器，每个文件完成时刷新列表并更新任务状态
    const unlisten = await listen<UploadCompleteEvent>(
      `sftp://upload_complete/${sessionId}`,
      async (event) => {
        const { path, success } = event.payload;
        if (success) {
          // 查找对应的任务并更新状态
          // 对于同名文件，查找第一个 pending/uploading 状态的任务
          const { uploadTasks } = get();
          for (const [id, task] of uploadTasks) {
            if (task.remotePath === path && (task.status === 'pending' || task.status === 'uploading')) {
              get().updateUploadTask(id, {
                status: 'completed',
                progress: 100,
              });

              // 减少活跃上传计数并处理队列
              set((state) => ({
                activeUploads: Math.max(0, state.activeUploads - 1),
              }));
              get().processUploadQueue();
              break;
            }
          }

          // 刷新文件列表，显示新上传的文件
          await get().navigate(currentPath);
        }
      }
    );

    // 保存 unlisten 函数，用于清理
    set({ uploadCompleteUnlisten: unlisten });

    // 开始处理队列
    get().processUploadQueue();
  },

  /**
   * 上传文件到指定路径（用于终端拖放上传）
   *
   * 与 uploadFiles 类似，但允许指定目标路径和会话信息，
   * 而不依赖 store 中的 currentPath/sessionId/connectionConfig
   */
  uploadFilesToPath: async (
    files: File[],
    targetPath: string,
    sessionId: string,
    connectionConfig: SFTPConnectConfig
  ) => {
    const { uploadPriority } = get();

    // 根据优先级策略排序文件
    let sortedFiles = [...files];
    if (uploadPriority === 'small-first') {
      sortedFiles.sort((a, b) => {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        return sizeA - sizeB; // 小文件优先
      });
    }

    // 创建任务并添加到队列
    const taskIds: string[] = [];
    sortedFiles.forEach(file => {
      try {
        // 在 Tauri 中，File 对象有 path 属性
        // @ts-ignore - Tauri File 对象有 path 属性
        const localPath = file.path || file.name;

        const remotePath = targetPath === '/'
          ? `/${file.name}`
          : `${targetPath}/${file.name}`;

        // 生成唯一任务 ID
        const counter = get().uploadTaskCounter + 1;
        set({ uploadTaskCounter: counter });
        const taskId = `task-${counter}-${Date.now()}`;
        taskIds.push(taskId);

        // 添加任务到 uploadTasks
        get().addUploadTask({
          id: taskId,
          sessionId,
          connectionConfig,
          fileName: file.name,
          remotePath,
          localPath,
          progress: 0,
          status: 'pending',
          createdAt: Date.now(),
          totalBytes: file.size || 0,
        });
      } catch (error) {
        console.error(`[sftpStore] Error creating task for ${file.name}:`, error);
      }
    });

    // 将新任务 ID 添加到队列
    set((state) => ({
      uploadQueue: [...state.uploadQueue, ...taskIds],
    }));

    // 设置完成监听器
    const unlisten = await listen<UploadCompleteEvent>(
      `sftp://upload_complete/${sessionId}`,
      async (event) => {
        const { path, success } = event.payload;
        if (success) {
          // 查找对应的任务并更新状态
          const { uploadTasks } = get();
          for (const [id, task] of uploadTasks) {
            if (task.remotePath === path && (task.status === 'pending' || task.status === 'uploading')) {
              get().updateUploadTask(id, {
                status: 'completed',
                progress: 100,
              });

              // 减少活跃上传计数并处理队列
              set((state) => ({
                activeUploads: Math.max(0, state.activeUploads - 1),
              }));
              get().processUploadQueue();
              break;
            }
          }
        }
      }
    );

    // 保存 unlisten 函数
    set({ uploadCompleteUnlisten: unlisten });

    // 临时设置 sessionId 和 connectionConfig 以便 processUploadQueue 使用
    const prevSessionId = get().sessionId;
    const prevConnectionConfig = get().connectionConfig;

    // 如果当前没有打开面板，临时设置会话信息
    if (!prevSessionId || !prevConnectionConfig) {
      set({ sessionId, connectionConfig });
    }

    // 开始处理队列
    get().processUploadQueue();

    // 如果之前没有打开面板，恢复状态
    if (!prevSessionId || !prevConnectionConfig) {
      // 不立即恢复，让上传继续进行
      // 上传完成后会通过监听器自动处理
    }
  },

  /**
   * 下载文件
   */
  downloadFile: async (file: SFTPFile) => {
    const { sessionId, connectionConfig } = get();
    if (!sessionId || !connectionConfig) {
      throw new Error('No active SSH session or connection config');
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');

      const localPath = await save({
        title: 'Save file',
        defaultPath: file.name,
        filters: [],
      });

      if (!localPath) {
        return;
      }

      const counter = get().downloadTaskCounter + 1;
      set({ downloadTaskCounter: counter });
      const taskId = `download-${counter}-${Date.now()}`;

      get().addDownloadTask({
        id: taskId,
        sessionId,
        fileName: file.name,
        remotePath: file.fullPath,
        localPath: localPath as string,
        progress: 0,
        status: 'downloading',
        totalBytes: file.size,
        createdAt: Date.now(),
      });

      await invoke('sftp_download', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        remotePath: file.fullPath,
        localPath: localPath,
      });

      // 下载完成
      get().updateDownloadTask(taskId, {
        status: 'completed',
        progress: 100,
      });
    } catch (error) {
      console.error(`Failed to download file ${file.name}:`, error);
      throw error;
    }
  },

  /**
   * 创建目录
   */
  createDirectory: async (name: string) => {
    const { sessionId, connectionConfig, currentPath, navigate } = get();
    if (!sessionId || !connectionConfig) {
      throw new Error('No active SSH session or connection config');
    }

    try {
      await invoke('sftp_mkdir', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        path: currentPath === '/' ? `/${name}` : `${currentPath}/${name}`,
      });

      // 刷新目录列表
      await navigate(currentPath);
    } catch (error) {
      console.error(`Failed to create directory ${name}:`, error);
      throw error;
    }
  },

  /**
   * 删除文件或目录
   */
  deleteItem: async (file: SFTPFile) => {
    const { sessionId, connectionConfig, currentPath, navigate } = get();
    if (!sessionId || !connectionConfig) {
      throw new Error('No active SSH session or connection config');
    }

    try {
      await invoke('sftp_delete', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        path: file.fullPath,
        isDirectory: file.isDirectory,
      });

      // 刷新目录列表
      await navigate(currentPath);
    } catch (error) {
      console.error(`Failed to delete ${file.name}:`, error);
      throw error;
    }
  },

  /**
   * 重命名文件或目录
   */
  renameItem: async (file: SFTPFile, newName: string) => {
    const { sessionId, connectionConfig, currentPath, navigate } = get();
    if (!sessionId || !connectionConfig) {
      throw new Error('No active SSH session or connection config');
    }

    try {
      const segments = file.fullPath.split('/').filter(Boolean);
      segments.pop();
      const parentPath = segments.length > 0 ? `/${segments.join('/')}` : '/';
      const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

      await invoke('sftp_rename', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        oldPath: file.fullPath,
        newPath,
      });

      // 刷新目录列表
      await navigate(currentPath);
    } catch (error) {
      console.error(`Failed to rename ${file.name}:`, error);
      throw error;
    }
  },

  /**
   * 设置错误状态
   */
  setError: (error: string | null) => {
    set({
      error,
      status: error ? 'error' : 'open',
    });
  },

  /**
   * 设置上传进度
   */
  setUploadProgress: (path: string, progress: TransferProgress) => {
    set((state) => ({
      uploadProgress: {
        ...state.uploadProgress,
        [path]: progress,
      },
    }));
  },

  /**
   * 设置下载进度
   */
  setDownloadProgress: (path: string, progress: TransferProgress) => {
    set((state) => ({
      downloadProgress: {
        ...state.downloadProgress,
        [path]: progress,
      },
    }));
  },

  /**
   * 清除上传进度
   */
  clearUploadProgress: (path: string) => {
    set((state) => {
      const newProgress = { ...state.uploadProgress };
      delete newProgress[path];
      return { uploadProgress: newProgress };
    });
  },

  /**
   * 清除下载进度
   */
  clearDownloadProgress: (path: string) => {
    set((state) => {
      const newProgress = { ...state.downloadProgress };
      delete newProgress[path];
      return { downloadProgress: newProgress };
    });
  },

  /**
   * 初始化进度监听
   * 监听 Tauri 发送的进度事件
   * 注意：使用 `panel-${sessionId}` 作为 key，与终端的监听器区分开
   * 这样关闭面板时不会影响终端的上传进度监听
   */
  initProgressListeners: () => {
    const { sessionId } = get();
    if (!sessionId) return undefined;

    // 使用 panel- 前缀的 key，与终端的监听器区分开
    const listenerKey = `panel-${sessionId}`;
    progressListenerManager.register(listenerKey, async () => {
      try {
        const [unlistenUpload, unlistenDownload] = await Promise.all([
          listen<{ path: string; progress: number }>(
            `sftp://upload_progress/${sessionId}`,
            (event) => {
              const { path, progress } = event.payload;
              get().setUploadProgress(path, {
                path,
                progress,
                completed: progress >= 100,
              });

              // 更新上传任务状态和进度
              // 对于同名文件，查找第一个 pending/uploading 状态的任务
              const { uploadTasks } = get();
              for (const [id, task] of uploadTasks) {
                if (task.remotePath === path && (task.status === 'pending' || task.status === 'uploading')) {
                  get().updateUploadTask(id, {
                    progress,
                    status: 'uploading',
                  });
                  break;
                }
              }
            }
          ),
          listen<{ path: string; progress: number }>(
            `sftp://download_progress/${sessionId}`,
            (event) => {
              const { path, progress } = event.payload;
              get().setDownloadProgress(path, {
                path,
                progress,
                completed: progress >= 100,
              });

              // 更新下载任务状态和进度
              const { downloadTasks } = get();
              for (const [id, task] of downloadTasks) {
                if (task.remotePath === path && task.status === 'downloading') {
                  get().updateDownloadTask(id, {
                    progress,
                  });
                  // 如果下载完成，更新状态
                  if (progress >= 100) {
                    get().updateDownloadTask(id, {
                      status: 'completed',
                      progress: 100,
                    });
                  }
                  break;
                }
              }
            }
          ),
        ]);

        // 返回清理函数
        return () => {
          unlistenUpload();
          unlistenDownload();
        };
      } catch (error) {
        console.error('[sftpStore] Failed to setup progress listeners:', error);
        return () => {};
      }
    });

    // 返回一个 cleanup 函数，用于清理该监听器
    return () => {
      progressListenerManager.cleanup(listenerKey);
    };
  },

  /**
   * 为指定会话初始化进度监听（用于终端拖放上传）
   * 与 initProgressListeners 类似，但接受 sessionId 参数
   * 注意：使用 `terminal-${sessionId}` 作为 key，与面板的监听器区分开
   */
  initProgressListenersForSession: (targetSessionId: string) => {
    if (!targetSessionId) return undefined;

    // 使用 terminal- 前缀的 key，与面板的监听器区分开
    const listenerKey = `terminal-${targetSessionId}`;
    progressListenerManager.register(listenerKey, async () => {
      try {
        const [unlistenUpload, unlistenDownload] = await Promise.all([
          listen<{ path: string; progress: number }>(
            `sftp://upload_progress/${targetSessionId}`,
            (event) => {
              const { path, progress } = event.payload;
              get().setUploadProgress(path, {
                path,
                progress,
                completed: progress >= 100,
              });

              // 更新上传任务状态和进度
              const { uploadTasks } = get();
              for (const [id, task] of uploadTasks) {
                if (task.remotePath === path && (task.status === 'pending' || task.status === 'uploading')) {
                  get().updateUploadTask(id, {
                    progress,
                    status: 'uploading',
                  });
                  break;
                }
              }
            }
          ),
          listen<{ path: string; progress: number }>(
            `sftp://download_progress/${targetSessionId}`,
            (event) => {
              const { path, progress } = event.payload;
              get().setDownloadProgress(path, {
                path,
                progress,
                completed: progress >= 100,
              });

              // 更新下载任务状态和进度
              const { downloadTasks } = get();
              for (const [id, task] of downloadTasks) {
                if (task.remotePath === path && task.status === 'downloading') {
                  get().updateDownloadTask(id, {
                    progress,
                  });
                  // 如果下载完成，更新状态
                  if (progress >= 100) {
                    get().updateDownloadTask(id, {
                      status: 'completed',
                      progress: 100,
                    });
                  }
                  break;
                }
              }
            }
          ),
        ]);

        // 返回清理函数
        return () => {
          unlistenUpload();
          unlistenDownload();
        };
      } catch (error) {
        console.error('[sftpStore] Failed to setup progress listeners for session:', error);
        return () => {};
      }
    });

    // 返回一个 cleanup 函数，用于清理该监听器
    return () => {
      progressListenerManager.cleanup(listenerKey);
    };
  },

  // ========== 上传任务管理 Actions ==========

  /**
   * 添加上传任务
   */
  addUploadTask: (task: UploadTask) => {
    set((state) => {
      const newTasks = new Map(state.uploadTasks);
      newTasks.set(task.id, task);
      return { uploadTasks: newTasks };
    });
  },

  /**
   * 更新上传任务
   */
  updateUploadTask: (id: string, updates: Partial<UploadTask>) => {
    set((state) => {
      const newTasks = new Map(state.uploadTasks);
      const existing = newTasks.get(id);
      if (existing) {
        newTasks.set(id, { ...existing, ...updates });
      }
      return { uploadTasks: newTasks };
    });
  },

  /**
   * 删除上传任务
   */
  removeUploadTask: (id: string) => {
    set((state) => {
      const newTasks = new Map(state.uploadTasks);
      newTasks.delete(id);
      return { uploadTasks: newTasks };
    });
  },

  /**
   * 清除已完成的任务
   */
  clearCompletedTasks: () => {
    set((state) => {
      const newTasks = new Map(state.uploadTasks);
      for (const [id, task] of newTasks) {
        if (task.status === 'completed') {
          newTasks.delete(id);
        }
      }
      return { uploadTasks: newTasks };
    });
  },

  /**
   * 取消上传任务
   */
  cancelUpload: async (taskId: string) => {
    const { uploadTasks, sessionId: storeSessionId } = get();
    const task = uploadTasks.get(taskId);

    if (!task) {
      console.error(`[sftpStore] Task not found: ${taskId}`);
      return;
    }

    if (task.status !== 'uploading' && task.status !== 'pending') {
      console.warn(`[sftpStore] Cannot cancel task with status: ${task.status}`);
      return;
    }

    // 优先使用任务的 sessionId
    const sessionId = task.sessionId || storeSessionId;

    if (!sessionId) {
      console.error('[sftpStore] No active SSH session');
      return;
    }

    try {
      // 调用后端取消命令
      await invoke('sftp_cancel_upload', {
        sessionId,
        remotePath: task.remotePath,
      });

      // 更新任务状态为已取消
      get().updateUploadTask(taskId, {
        status: 'cancelled',
      });

      // 减少活跃上传计数并处理队列
      set((state) => ({
        activeUploads: Math.max(0, state.activeUploads - 1),
      }));
      get().processUploadQueue();
    } catch (error) {
      console.error(`[sftpStore] Failed to cancel upload ${task.fileName}:`, error);
      // 即使取消失败，也更新任务状态为失败
      get().updateUploadTask(taskId, {
        status: 'failed',
        error: typeof error === 'string' ? error : (error as Error)?.message || 'Cancel failed',
      });
      // 减少活跃上传计数并处理队列
      set((state) => ({
        activeUploads: Math.max(0, state.activeUploads - 1),
      }));
      get().processUploadQueue();
    }
  },

  /**
   * 处理上传队列
   * 启动可以并发的新任务（当 activeUploads < maxConcurrentUploads）
   */
  processUploadQueue: () => {
    const { uploadQueue, uploadTasks, activeUploads, maxConcurrentUploads, sessionId: storeSessionId, connectionConfig: storeConfig } = get();

    // 计算可以启动的任务数量
    const availableSlots = maxConcurrentUploads - activeUploads;
    if (availableSlots <= 0 || uploadQueue.length === 0) {
      return;
    }

    // 获取要启动的任务（取前 N 个）
    const tasksToStart = uploadQueue.slice(0, availableSlots);
    const remainingQueue = uploadQueue.slice(availableSlots);

    // 更新队列
    set({
      uploadQueue: remainingQueue,
      activeUploads: activeUploads + tasksToStart.length,
    });

    // 启动每个任务的上传
    tasksToStart.forEach(taskId => {
      const task = uploadTasks.get(taskId);
      if (!task) {
        return;
      }

      // 优先使用任务的配置，其次使用 store 的配置
      const sessionId = task.sessionId || storeSessionId;
      const connectionConfig = task.connectionConfig || storeConfig;

      if (!sessionId || !connectionConfig) {
        console.warn('[sftpStore] No session or config for task:', taskId);
        get().updateUploadTask(taskId, {
          status: 'failed',
          error: 'No session or connection config available',
        });
        set((state) => ({
          activeUploads: Math.max(0, state.activeUploads - 1),
        }));
        get().processUploadQueue();
        return;
      }

      get().updateUploadTask(taskId, { status: 'uploading' });

      invoke('sftp_upload', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        localPath: task.localPath,
        remotePath: task.remotePath,
      }).catch(err => {
        get().updateUploadTask(taskId, {
          status: 'failed',
          error: typeof err === 'string' ? err : err?.message || 'Unknown error',
        });
        set((state) => ({
          activeUploads: Math.max(0, state.activeUploads - 1),
        }));
        get().processUploadQueue();
      });
    });
  },

  /**
   * 重试上传任务（支持断点续传）
   * @param taskId 任务 ID
   * @param resume 是否断点续传（true: 从上次位置继续, false: 从头开始）
   */
  retryUpload: async (taskId: string, resume: boolean) => {
    const { uploadTasks, sessionId: storeSessionId, connectionConfig: storeConfig } = get();
    const task = uploadTasks.get(taskId);

    if (!task) {
      return;
    }

    if (task.status !== 'failed' && task.status !== 'cancelled') {
      return;
    }

    // 优先使用任务的配置，其次使用 store 的配置
    const sessionId = task.sessionId || storeSessionId;
    const connectionConfig = task.connectionConfig || storeConfig;

    if (!sessionId || !connectionConfig) {
      return;
    }

    try {
      const resumeFrom = resume && task.uploadedBytes ? task.uploadedBytes : undefined;

      get().updateUploadTask(taskId, {
        status: 'uploading',
        error: undefined,
      });

      invoke('sftp_upload', {
        sessionId,
        config: buildSFTPConfig(connectionConfig),
        localPath: task.localPath,
        remotePath: task.remotePath,
        resumeFrom,
      }).catch(err => {
        get().updateUploadTask(taskId, {
          status: 'failed',
          error: typeof err === 'string' ? err : err?.message || 'Unknown error',
        });
        set((state) => ({
          activeUploads: Math.max(0, state.activeUploads - 1),
        }));
        get().processUploadQueue();
      });

      // 增加活跃上传计数
      set((state) => ({
        activeUploads: state.activeUploads + 1,
      }));
    } catch (error) {
      console.error(`[sftpStore] Error starting retry for ${task.fileName}:`, error);
      get().updateUploadTask(taskId, {
        status: 'failed',
        error: typeof error === 'string' ? error : (error as Error)?.message || 'Retry failed',
      });
    }
  },

  // ========== 下载任务管理 Actions ==========

  /**
   * 添加下载任务
   */
  addDownloadTask: (task: DownloadTask) => {
    set((state) => {
      const newTasks = new Map(state.downloadTasks);
      newTasks.set(task.id, task);
      return { downloadTasks: newTasks };
    });
  },

  /**
   * 更新下载任务
   */
  updateDownloadTask: (id: string, updates: Partial<DownloadTask>) => {
    set((state) => {
      const newTasks = new Map(state.downloadTasks);
      const task = newTasks.get(id);
      if (task) {
        newTasks.set(id, { ...task, ...updates });
      }
      return { downloadTasks: newTasks };
    });
  },

  /**
   * 删除下载任务
   */
  removeDownloadTask: (id: string) => {
    set((state) => {
      const newTasks = new Map(state.downloadTasks);
      newTasks.delete(id);
      return { downloadTasks: newTasks };
    });
  },

  /**
   * 清除已完成的下载任务
   */
  clearCompletedDownloads: () => {
    set((state) => {
      const newTasks = new Map(
        Array.from(state.downloadTasks.entries()).filter(
          ([, task]) => task.status !== 'completed'
        )
      );
      return { downloadTasks: newTasks };
    });
  },

  /**
   * Get upload summary for a session
   */
  getUploadSummary: (sessionId: string): UploadSummary => {
    const { uploadTasks, uploadQueue } = get();

    // Filter tasks for this session
    const sessionTasks = Array.from(uploadTasks.values()).filter(
      task => task.sessionId === sessionId
    );

    const uploading = sessionTasks.filter(t => t.status === 'uploading').length;
    const queued = uploadQueue.filter(id => {
      const task = uploadTasks.get(id);
      return task?.sessionId === sessionId && task.status === 'pending';
    }).length;
    const completed = sessionTasks.filter(t => t.status === 'completed').length;
    const failed = sessionTasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length;
    const total = sessionTasks.length;

    // Find current uploading file
    const currentTask = sessionTasks.find(t => t.status === 'uploading');
    const currentFile = currentTask?.fileName || '';

    // Calculate overall progress
    const totalProgress = sessionTasks.reduce((sum, t) => sum + t.progress, 0);
    const progress = total > 0 ? Math.round(totalProgress / total) : 0;

    // Determine status
    let status: UploadSummary['status'] = 'idle';
    if (uploading > 0 || queued > 0) {
      status = 'uploading';
    } else if (failed > 0 && completed > 0) {
      status = 'partial-failure';
    } else if (failed > 0 && completed === 0) {
      status = 'failed';
    } else if (completed > 0 && failed === 0) {
      status = 'success';
    }

    return {
      total,
      uploading,
      queued,
      completed,
      failed,
      currentFile,
      progress,
      status,
    };
  },
}));

// ==================== 类型导出 ====================

export type { SFTPSheetState };
