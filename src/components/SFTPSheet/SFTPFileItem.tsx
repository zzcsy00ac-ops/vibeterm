/**
 * SFTP 文件项组件
 *
 * 显示单个文件或目录的行，包括图标、名称、权限、大小和修改时间
 */

import { type FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFileIcon } from '../../utils/fileIcons';
import { formatBytes, getModeString, formatLocalDate } from '../../utils/format';
import type { SFTPFile } from '../../store/sftpStore';
import { ChevronRight } from 'lucide-react';
import './SFTPFileItem.css';

// ==================== 接口定义 ====================

export interface SFTPFileItemProps {
  /** 文件信息 */
  file: SFTPFile;
  /** 是否选中 */
  selected?: boolean;
  /** 双击事件 */
  onDoubleClick?: (file: SFTPFile) => void;
  /** 单击事件 */
  onClick?: (file: SFTPFile) => void;
  /** 右键菜单事件 */
  onContextMenu?: (file: SFTPFile, position: { x: number; y: number }) => void;
  /** 是否禁用右键菜单处理（当用作 ContextMenu.Trigger 时） */
  disableContextMenu?: boolean;
}

// ==================== 组件 ====================

export const SFTPFileItem: FC<SFTPFileItemProps> = ({
  file,
  selected = false,
  onDoubleClick,
  onClick,
  onContextMenu,
  disableContextMenu = false,
}) => {
  const { t } = useTranslation();

  // ==================== 事件处理 ====================

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(file);
  }, [file, onDoubleClick]);

  const handleClick = useCallback(() => {
    onClick?.(file);
  }, [file, onClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (disableContextMenu) {
      // 用作 ContextMenu.Trigger 时，什么都不做，让事件冒泡到 Radix UI
      return;
    }
    // 独立使用时，阻止默认并调用自定义回调
    e.preventDefault();
    onContextMenu?.(file, { x: e.clientX, y: e.clientY });
  }, [file, onContextMenu, disableContextMenu]);

  // ==================== 计算属性 ====================

  // 获取文件图标
  const icon = useMemo(() => {
    return getFileIcon(file, false, 20);
  }, [file]);

  // 格式化权限模式
  const modeString = useMemo(() => {
    return getModeString(file.mode);
  }, [file.mode]);

  // 格式化文件大小
  const sizeString = useMemo(() => {
    return formatBytes(file.size);
  }, [file.size]);

  // 格式化修改时间
  const timeString = useMemo(() => {
    return formatLocalDate(file.mtime);
  }, [file.mtime]);

  // ==================== 渲染 ====================

  return (
    <div
      className={`sftp-file-item ${selected ? 'sftp-file-item--selected' : ''}`}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={file.name}
    >
      {/* 图标和名称 */}
      <div className="sftp-file-item__primary">
        <span className="sftp-file-item__icon">{icon}</span>
        <span className="sftp-file-item__name">{file.name}</span>
        {file.isSymlink && (
          <span className="sftp-file-item__symlink-indicator">
            <ChevronRight size={14} />
          </span>
        )}
      </div>

      {/* 权限 */}
      <div className="sftp-file-item__mode" title={t('sftp.fileItem.permission')}>
        {modeString}
      </div>

      {/* 大小（仅文件显示） */}
      {!file.isDirectory && (
        <div className="sftp-file-item__size" title={t('sftp.fileItem.size')}>
          {sizeString}
        </div>
      )}

      {/* 修改时间 */}
      <div className="sftp-file-item__date" title={t('sftp.fileItem.modified')}>
        {timeString}
      </div>
    </div>
  );
};

SFTPFileItem.displayName = 'SFTPFileItem';
