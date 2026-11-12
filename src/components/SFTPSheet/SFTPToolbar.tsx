/**
 * SFTP 工具栏组件
 *
 * 包含面包屑导航和操作按钮（返回、刷新、过滤、上传、创建目录、关闭）
 */

import { type FC, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUp,
  RefreshCw,
  Upload,
  FolderPlus,
  Filter,
  X,
  ChevronRight,
  Home,
} from 'lucide-react';
import { open } from '../../lib/tauri-api';
import { useSFTPSheet } from '../../store/sftpStore';
import { CreateDirectoryDialog, useCreateDirectoryDialog } from './CreateDirectoryDialog';
import './SFTPToolbar.css';

// ==================== 类型定义 ====================

export interface SFTPToolbarProps {
  /** 关闭回调 */
  onClose?: () => void;
}

// ==================== 组件 ====================

export const SFTPToolbar: FC<SFTPToolbarProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const {
    currentPath,
    goUp,
    refresh,
    toggleFilter,
    showFilter,
    closeSheet,
    uploadFiles,
  } = useSFTPSheet();
  const createDirDialog = useCreateDirectoryDialog();

  // ==================== 面包屑导航 ====================

  const pathSegments = useMemo(() => {
    if (currentPath === '/' || currentPath === '') {
      return [];
    }

    const segments: { name: string; path: string }[] = [];
    const parts = currentPath.split('/').filter(Boolean);

    let pathAccum = '';
    for (const part of parts) {
      pathAccum += `/${part}`;
      segments.push({
        name: part,
        path: pathAccum,
      });
    }

    return segments;
  }, [currentPath]);

  // ==================== 事件处理 ====================

  const handleNavigateToRoot = useCallback(() => {
    const { navigate } = useSFTPSheet.getState();
    navigate('/');
  }, []);

  const handleNavigateToSegment = useCallback((path: string) => {
    const { navigate } = useSFTPSheet.getState();
    navigate(path);
  }, []);

  const handleClose = useCallback(() => {
    closeSheet();
    onClose?.();
  }, [closeSheet, onClose]);

  // ==================== 渲染 ====================

  return (
    <div className="sftp-toolbar">
      {/* 左侧：导航和路径 */}
      <div className="sftp-toolbar__left">
        {/* 返回上级按钮 */}
        <button
          className="sftp-toolbar__button"
          onClick={goUp}
          title={t('sftp.toolbar.goUp')}
          disabled={currentPath === '/' || currentPath === ''}
          aria-label={t('sftp.toolbar.goUp')}
        >
          <ArrowUp size={16} />
        </button>

        {/* 刷新按钮 */}
        <button
          className="sftp-toolbar__button"
          onClick={refresh}
          title={t('sftp.toolbar.refresh')}
          aria-label={t('sftp.toolbar.refresh')}
        >
          <RefreshCw size={16} />
        </button>

        {/* 面包屑导航 */}
        <nav className="sftp-breadcrumb" aria-label="Breadcrumb navigation">
          {/* 根目录 */}
          <button
            className="sftp-breadcrumb__item sftp-breadcrumb__item--root"
            onClick={handleNavigateToRoot}
            title="/"
            aria-label="Root directory"
          >
            <Home size={14} />
          </button>

          {/* 路径段 */}
          {pathSegments.map((segment, index) => (
            <div key={segment.path} className="sftp-breadcrumb__segment">
              <ChevronRight size={14} className="sftp-breadcrumb__separator" />
              <button
                className={`sftp-breadcrumb__item ${
                  index === pathSegments.length - 1
                    ? 'sftp-breadcrumb__item--current'
                    : ''
                }`}
                onClick={() => handleNavigateToSegment(segment.path)}
                title={segment.path}
              >
                {segment.name}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="sftp-toolbar__right">
        {/* 过滤按钮 */}
        <button
          className="sftp-toolbar__button"
          onClick={toggleFilter}
          title={t('sftp.toolbar.toggleFilter')}
          data-active={showFilter}
          aria-label={t('sftp.toolbar.toggleFilter')}
          aria-pressed={showFilter}
        >
          <Filter size={16} />
        </button>

        {/* 创建目录按钮 */}
        <button
          className="sftp-toolbar__button"
          onClick={createDirDialog.openDialog}
          title={t('sftp.toolbar.createDirectory')}
          aria-label={t('sftp.toolbar.createDirectory')}
        >
          <FolderPlus size={16} />
        </button>

        {/* 上传按钮 */}
        <button
          className="sftp-toolbar__button"
          onClick={async () => {
            try {
              // 打开文件选择对话框
              const selected = await open({
                multiple: true,
                directory: false,
                title: t('sftp.toolbar.selectFiles'),
              });

              if (selected) {
                // Tauri 返回的是文件路径数组
                // 需要转换为 File 对象
                const paths = Array.isArray(selected) ? selected : [selected];
                const files = paths.map((path: string) => {
                  // 从路径中提取文件名
                  const fileName = path.split('/').pop() || path.split('\\').pop() || path;
                  // 创建一个带有 path 属性的 File 对象
                  const file = new File([], fileName);
                  // @ts-ignore - Tauri File 对象有 path 属性
                  file.path = path;
                  return file;
                });
                await uploadFiles(files);
              }
            } catch (error) {
              console.error('[SFTPToolbar] File selection error:', error);
            }
          }}
          title={t('sftp.toolbar.upload')}
          aria-label={t('sftp.toolbar.upload')}
        >
          <Upload size={16} />
        </button>

        {/* 分隔线 */}
        <div className="sftp-toolbar__separator" />

        {/* 关闭按钮 */}
        <button
          className="sftp-toolbar__button sftp-toolbar__button--close"
          onClick={handleClose}
          title={t('sftp.toolbar.close')}
          aria-label={t('sftp.toolbar.close')}
        >
          <X size={16} />
        </button>
      </div>

      {/* 创建目录对话框 */}
      <CreateDirectoryDialog
        open={createDirDialog.open}
        onOpenChange={createDirDialog.onOpenChange}
      />
    </div>
  );
};

SFTPToolbar.displayName = 'SFTPToolbar';
