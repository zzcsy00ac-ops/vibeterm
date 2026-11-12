/**
 * SFTP 文件列表组件
 *
 * 显示文件列表，支持拖放上传、文件过滤和空状态显示
 * 使用 Tauri 的 file-drop 事件系统来获取完整文件路径
 */

import { type FC, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { Loader2, FileX, UploadCloud, Search, X, Download, Trash2, Copy, Edit3, FolderOpen, AlertTriangle } from 'lucide-react';
import { useSFTPSheet, type SFTPFile } from '../../store/sftpStore';
import { SFTPFileItem } from './SFTPFileItem';
import ContextMenu from '../ContextMenu';
import { Dialog, type DialogRef } from '../Dialog';
import { createIdempotentListenerManager } from '../../utils/idempotentListenerManager';
import './SFTPFileList.css';

// ==================== 类型定义 ====================

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

// ==================== 拖放监听器管理器 ====================

/**
 * 全局拖放监听器管理器
 * 使用幂等管理器确保每个组件实例 ID 只注册一次监听器
 */
const dragDropListenerManager = createIdempotentListenerManager();

// ==================== 组件 ====================

export const SFTPFileList: FC = () => {
  const { t } = useTranslation();
  const {
    isLoading,
    currentPath,
    navigate,
    showFilter,
    filterText,
    setFilterText,
    filteredFiles,
    uploadFiles,
    checkFileExists,
    downloadFile,
    deleteItem,
    renameItem,
  } = useSFTPSheet();

  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Dialog ref
  const dialogRef = useRef<DialogRef>(null);

  // ContextMenu 状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    file: SFTPFile | null;
  }>({ visible: false, x: 0, y: 0, file: null });

  // 生成唯一的组件实例 ID，用于幂等监听器管理
  const instanceIdRef = useRef<string>(`sftp-file-list-${Date.now()}-${Math.random()}`);

  // ==================== Tauri 拖放事件监听 ====================

  useEffect(() => {
    const element = dropzoneRef.current;
    if (!element) return;

    // 检查点是否在 dropzone 区域内
    const isOverDropzone = (x: number, y: number): boolean => {
      const target = document.elementFromPoint(x, y);
      if (!target) return false;
      let current: Element | null = target;
      while (current) {
        if (current === element) return true;
        current = current.parentElement;
      }
      return false;
    };

    // 检查元素是否在可见的 tab 中（多会话场景）
    const isElementVisible = () => element.offsetParent !== null;

    // 使用幂等管理器注册拖放监听器
    // StrictMode 下会调用多次，但 register() 的幂等性保证只注册一次
    dragDropListenerManager.register(instanceIdRef.current, async () => {
      const [unlistenHover, unlistenDrop, unlistenLeave] = await Promise.all([
        // hover 事件：更新拖放状态
        listen<DragDropPayload>('tauri://drag-over', (event) => {
          setIsDragActive(isOverDropzone(event.payload.position.x, event.payload.position.y) && isElementVisible());
        }),
        // drop 事件：处理文件上传
        listen<DragDropPayload>('tauri://drag-drop', async (event) => {
          const { paths, position } = event.payload;
          if (isOverDropzone(position.x, position.y) && isElementVisible() && paths.length > 0) {
            // 转换路径为 File 对象
            const files = paths.map((path) => {
              // 移除可能存在的单引号（Windows 路径有时会有）
              let cleanPath = path.replace(/^'(.*)'$/, '$1');
              // 提取文件名（同时处理 Unix 和 Windows 路径分隔符）
              let name = cleanPath.split(/[\/\\]/).pop() || cleanPath;
              // 移除文件名首尾的单引号或双引号（Tauri 对中文/非ASCII文件名会添加引号）
              name = name.replace(/^['"]|['"]$/g, '');
              const file = new File([], name);
              // @ts-ignore - Tauri File 对象有 path 属性
              file.path = cleanPath;
              return file;
            });

            // 检查文件是否存在并确认覆盖
            const filesToUpload: File[] = [];
            const filesToSkip: File[] = [];

            for (const file of files) {
              const remotePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
              const exists = await checkFileExists(remotePath);

              if (exists) {
                // 文件已存在，需要确认
                const confirmed = await new Promise<boolean>((resolve) => {
                  dialogRef.current?.confirm({
                    title: t('sftp.upload.overwrite.title'),
                    content: (
                      <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <p style={{ fontSize: '14px' }}>
                          {t('sftp.upload.overwrite.confirm', { name: file.name })}
                        </p>
                      </div>
                    ),
                    confirmText: t('common.buttons.confirm'),
                    cancelText: t('common.buttons.cancel'),
                    type: 'danger',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                  });
                });

                if (confirmed) {
                  filesToUpload.push(file);
                } else {
                  filesToSkip.push(file);
                }
              } else {
                filesToUpload.push(file);
              }
            }

            // 上传确认的文件
            if (filesToUpload.length > 0) {
              uploadFiles(filesToUpload);
            }
          }
          setIsDragActive(false);
        }),
        // leave 事件：清除拖放状态
        listen<void>('tauri://drag-leave', () => {
          setIsDragActive(false);
        }),
      ]);

      return () => {
        unlistenHover();
        unlistenDrop();
        unlistenLeave();
      };
    });

    // 组件卸载时清理监听器
    return () => {
      dragDropListenerManager.cleanup(instanceIdRef.current);
    };
  }, [uploadFiles]); // uploadFiles 变化时重新注册（虽然很少变化）

  // ==================== 文件操作 ====================

  const handleFileDoubleClick = useCallback((file: SFTPFile) => {
    if (file.isDirectory) {
      navigate?.(file.fullPath);
    }
  }, [navigate]);

  // 下载文件
  const handleDownload = useCallback(async (file: SFTPFile) => {
    if (file.isDirectory) {
      return;
    }

    try {
      await downloadFile(file);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Download failed: ${errorMessage}`);
    }
  }, [downloadFile]);

  // 重命名文件 - 使用 Dialog prompt
  const handleRename = useCallback((file: SFTPFile) => {
    dialogRef.current?.prompt({
      title: t('sftp.contextMenu.rename'),
      message: t('sftp.contextMenu.renamePrompt'),
      placeholder: file.name,
      defaultValue: file.name,
      confirmText: t('common.buttons.confirm'),
      cancelText: t('common.buttons.cancel'),
      onConfirm: (newName) => {
        if (newName && newName !== file.name) {
          renameItem(file, newName).catch(error => {
            console.error('[SFTPFileList] Rename failed:', error);
          });
        }
      },
    });
  }, [renameItem, t]);

  // 确认删除
  const handleConfirmDelete = useCallback(async (file: SFTPFile) => {
    try {
      await deleteItem(file);
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [deleteItem]);

  // 删除文件 - 打开确认对话框
  const handleDelete = useCallback((file: SFTPFile) => {
    dialogRef.current?.confirm({
      title: t('sftp.delete.title'),
      content: (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <AlertTriangle size={48} style={{ color: 'var(--color-error)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', marginBottom: '4px' }}>
            {t('sftp.delete.confirm', { name: file.name })}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--gray-10)' }}>
            {t('sftp.delete.warning')}
          </p>
        </div>
      ),
      confirmText: t('common.buttons.delete'),
      cancelText: t('common.buttons.cancel'),
      type: 'danger',
      onConfirm: () => handleConfirmDelete(file),
    });
  }, [t, handleConfirmDelete]);

  // 复制路径
  const handleCopyPath = useCallback(async (file: SFTPFile) => {
    try {
      await navigator.clipboard.writeText(file.fullPath);
    } catch (error) {
      console.error('[SFTPFileList] Copy path failed:', error);
    }
  }, []);

  // 打开文件夹
  const handleOpenFolder = useCallback((file: SFTPFile) => {
    if (file.isDirectory) {
      navigate?.(file.fullPath);
    }
  }, [navigate]);

  // 右键菜单
  const handleFileContextMenu = useCallback((file: SFTPFile, position: { x: number; y: number }) => {
    setContextMenu({
      visible: true,
      x: position.x,
      y: position.y,
      file,
    });
  }, []);

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // 构建菜单项配置
  const buildMenuItems = useCallback((file: SFTPFile) => {
    return [
      // 打开文件夹（仅目录显示）
      ...(file.isDirectory ? [{
        key: 'open',
        label: t('sftp.contextMenu.open'),
        icon: <FolderOpen size={14} />,
        onClick: () => {
          handleOpenFolder(file);
          closeContextMenu();
        },
      }] : []),
      // 下载（仅文件显示）
      ...(!file.isDirectory ? [{
        key: 'download',
        label: t('sftp.contextMenu.download'),
        icon: <Download size={14} />,
        onClick: () => {
          handleDownload(file);
          closeContextMenu();
        },
      }] : []),
      // 重命名
      {
        key: 'rename',
        label: t('sftp.contextMenu.rename'),
        icon: <Edit3 size={14} />,
        onClick: () => {
          handleRename(file);
          closeContextMenu();
        },
      },
      // 复制路径
      {
        key: 'copyPath',
        label: t('sftp.contextMenu.copyPath'),
        icon: <Copy size={14} />,
        onClick: () => {
          handleCopyPath(file);
          closeContextMenu();
        },
      },
      // 分隔线 + 删除
      {
        key: 'delete',
        label: t('sftp.contextMenu.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        separator: true,
        onClick: () => {
          handleDelete(file);
          closeContextMenu();
        },
      },
    ];
  }, [t, handleOpenFolder, handleDownload, handleRename, handleCopyPath, handleDelete, closeContextMenu]);

  // ==================== 渲染 ====================

  return (
    <div className="sftp-file-list">
      {/* 过滤栏 */}
      {showFilter && (
        <div className="sftp-filter-bar">
          <Search size={16} className="sftp-filter-bar__icon" />
          <input
            type="text"
            className="sftp-filter-bar__input"
            placeholder={t('sftp.filter.placeholder')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />
          {filterText && (
            <button
              className="sftp-filter-bar__clear"
              onClick={() => setFilterText('')}
              aria-label={t('sftp.filter.clear')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* 拖放上传区域 - 始终渲染 */}
      <div
        ref={dropzoneRef}
        className={`sftp-files ${isDragActive ? 'sftp-files--drag-active' : ''}`}
      >
        {/* 加载状态 */}
        {isLoading && (
          <div className="sftp-file-list--loading">
            <Loader2 className="sftp-file-list__spinner" size={32} />
            <span className="sftp-file-list__status-text">
              {t('sftp.fileList.loading')}
            </span>
          </div>
        )}

        {/* 拖放提示覆盖层 */}
        {isDragActive && !isLoading && (
          <div className="sftp-files__drag-overlay">
            <UploadCloud size={48} />
            <span className="sftp-files__drag-text">
              {t('sftp.fileList.dropFiles')}
            </span>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && filteredFiles.length === 0 && (
          <div className="sftp-empty">
            <FileX size={48} className="sftp-empty__icon" />
            <span className="sftp-empty__text">
              {showFilter && filterText
                ? t('sftp.fileList.noResults')
                : currentPath === '/'
                ? t('sftp.fileList.rootEmpty')
                : t('sftp.fileList.empty')}
            </span>
            <span className="sftp-empty__hint">
              {showFilter && filterText
                ? t('sftp.fileList.tryDifferentFilter')
                : t('sftp.fileList.dragToUpload')}
            </span>
          </div>
        )}

        {/* 文件列表 */}
        {!isLoading && filteredFiles.length > 0 && (
          <div className="sftp-file-items">
            {/* 列表头 */}
            <div className="sftp-file-list__header">
              <span className="sftp-file-list__header-name">
                {t('sftp.fileList.header.name')}
              </span>
              <span className="sftp-file-list__header-mode">
                {t('sftp.fileList.header.permission')}
              </span>
              <span className="sftp-file-list__header-size">
                {t('sftp.fileList.header.size')}
              </span>
              <span className="sftp-file-list__header-date">
                {t('sftp.fileList.header.modified')}
              </span>
            </div>

            {/* 文件项 */}
            {filteredFiles.map((file) => (
              <SFTPFileItem
                key={file.fullPath}
                file={file}
                onDoubleClick={handleFileDoubleClick}
                onClick={() => {}}
                onContextMenu={handleFileContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* 通用 Dialog */}
      <Dialog ref={dialogRef} />

      {/* 右键菜单 */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.file ? buildMenuItems(contextMenu.file) : []}
        onClose={closeContextMenu}
      />
    </div>
  );
};

SFTPFileList.displayName = 'SFTPFileList';
