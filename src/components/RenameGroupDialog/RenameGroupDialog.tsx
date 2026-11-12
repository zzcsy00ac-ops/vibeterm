/**
 * 重命名分组对话框组件
 *
 * 用于重命名 SSH 分组
 */

import * as Dialog from '@radix-ui/react-dialog';
import { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSSHStore } from '../../store/sshStore';
import './RenameGroupDialog.css';

export interface RenameGroupDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 分组 ID */
  groupId: string;
  /** 当前分组名称 */
  currentName: string;
  /** 重命名成功后的回调 */
  onSuccess?: () => void;
}

export const RenameGroupDialog = forwardRef<HTMLDivElement, RenameGroupDialogProps>(
  ({ open, onOpenChange, groupId, currentName, onSuccess }, ref) => {
    const { t } = useTranslation();
    const renameGroup = useSSHStore(state => state.renameGroup);
    const [inputValue, setInputValue] = useState(currentName);

    // 使用 useState 初始化，确保首次渲染时就有值
    const [portalContainer] = useState<HTMLDivElement | null>(() =>
      document.querySelector('.app-container') as HTMLDivElement
    );

    // 当对话框打开或 currentName 变化时，更新输入框的值
    useEffect(() => {
      if (open) {
        setInputValue(currentName);
      }
    }, [open, currentName]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get('name') as string;

      if (!name || !name.trim()) {
        return;
      }

      // 如果名称没有变化，直接关闭
      if (name.trim() === currentName) {
        onOpenChange(false);
        return;
      }

      try {
        renameGroup(groupId, name.trim());

        // 重置表单
        e.currentTarget.reset();
        setInputValue('');

        // 关闭对话框
        onOpenChange(false);

        // 触发成功回调
        onSuccess?.();
      } catch (error) {
        console.error('[RenameGroupDialog] Failed to rename group:', error);
      }
    };

    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={portalContainer || undefined}>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content create-group-dialog" ref={ref}>
            <Dialog.Title className="dialog-title">
              {t('ssh.dialogs.renameGroup')}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="dialog-form">
              <div className="form-field">
                <label htmlFor="group-name" className="form-label">
                  {t('ssh.form.newGroupName')} <span className="required">*</span>
                </label>
                <input
                  id="group-name"
                  name="name"
                  type="text"
                  className="form-input"
                  placeholder={currentName}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="dialog-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onOpenChange(false)}
                >
                  {t('ssh.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('ssh.buttons.rename')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

RenameGroupDialog.displayName = 'RenameGroupDialog';
