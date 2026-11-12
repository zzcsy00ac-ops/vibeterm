/**
 * 删除确认对话框组件
 *
 * 用于确认删除分组或 SSH 配置的危险操作
 */

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DeleteConfirmDialog.css';

export type DeleteType = 'group' | 'profile';

export interface DeleteConfirmDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 删除类型 */
  type: DeleteType;
  /** 要删除项的名称 */
  name: string;
  /** 确认删除回调 */
  onConfirm: () => void;
}

export const DeleteConfirmDialog = forwardRef<HTMLDivElement, DeleteConfirmDialogProps>(
  ({ open, onOpenChange, type, name, onConfirm }, ref) => {
    const { t } = useTranslation();
    // 使用 useState 初始化，确保首次渲染时就有值
    const [portalContainer] = useState<HTMLDivElement | null>(() =>
      document.querySelector('.app-container') as HTMLDivElement
    );

    const handleConfirm = () => {
      onConfirm();
      onOpenChange(false);
    };

    // 根据类型获取确认消息
    const getConfirmMessage = () => {
      if (type === 'group') {
        return t('ssh.dialogs.deleteGroupConfirm', { name });
      }
      return t('ssh.dialogs.deleteProfileConfirm', { name });
    };

    return (
      <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
        <AlertDialog.Portal container={portalContainer || undefined}>
          <AlertDialog.Overlay className="alert-dialog-overlay" />
          <AlertDialog.Content className="alert-dialog-content" ref={ref}>
            <AlertDialog.Title className="alert-dialog-title">
              {t('ssh.dialogs.deleteConfirmTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="alert-dialog-description">
              {getConfirmMessage()}
            </AlertDialog.Description>
            <div className="alert-dialog-footer">
              <AlertDialog.Cancel asChild>
                <button className="btn btn-secondary">
                  {t('ssh.buttons.cancel')}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button className="btn btn-danger" onClick={handleConfirm}>
                  {t('ssh.buttons.delete')}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    );
  }
);

DeleteConfirmDialog.displayName = 'DeleteConfirmDialog';
