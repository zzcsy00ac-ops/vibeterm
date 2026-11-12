/**
 * 创建目录对话框组件
 *
 * 使用 Radix UI Dialog 实现模态对话框
 */

import * as Dialog from '@radix-ui/react-dialog';
import { type FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSFTPSheet } from '../../store/sftpStore';
import './CreateDirectoryDialog.css';

// ==================== 类型定义 ====================

export interface CreateDirectoryDialogProps {
  /** 是否打开 */
  open?: boolean;
  /** 打开状态变化回调 */
  onOpenChange?: (open: boolean) => void;
}

// ==================== 组件 ====================

export const CreateDirectoryDialog: FC<CreateDirectoryDialogProps> = ({
  open: controlledOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { createDirectory } = useSFTPSheet();
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // 受控或非受控模式
  const isControlled = controlledOpen !== undefined;
  const actualOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // 关闭时重置状态
      setName('');
      setError(null);
    }
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  }, [isControlled, onOpenChange]);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError(t('sftp.createDir.nameRequired'));
      return;
    }

    // 验证文件夹名称（不允许包含特殊字符）
    if (/[\/\\:*?"<>|]/.test(trimmedName)) {
      setError(t('sftp.createDir.invalidName'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createDirectory(trimmedName);
      // 成功后关闭对话框
      handleOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [name, createDirectory, t, handleOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      handleOpenChange(false);
    }
  }, [handleCreate, handleOpenChange]);

  return (
    <Dialog.Root open={actualOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="create-dir-overlay" />
        <Dialog.Content
          className="create-dir-content"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className="create-dir-title">
            {t('sftp.createDir.title')}
          </Dialog.Title>

          <div className="create-dir-body">
            <label className="create-dir-label" htmlFor="dir-name-input">
              {t('sftp.createDir.nameLabel')}
            </label>
            <input
              id="dir-name-input"
              type="text"
              className="create-dir-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('sftp.createDir.placeholder')}
              autoFocus
              autoComplete="off"
            />

            {error && (
              <div className="create-dir-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="create-dir-footer">
            <Dialog.Close asChild>
              <button className="create-dir-button create-dir-button--cancel">
                {t('common.buttons.cancel')}
              </button>
            </Dialog.Close>
            <button
              className="create-dir-button create-dir-button--create"
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? t('sftp.createDir.creating') : t('sftp.createDir.create')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

CreateDirectoryDialog.displayName = 'CreateDirectoryDialog';

// ==================== 导出 Hook ====================

/**
 * 使用创建目录对话框的便捷 Hook
 */
export function useCreateDirectoryDialog() {
  const [open, setOpen] = useState(false);

  return {
    open,
    onOpenChange: setOpen,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  };
}
