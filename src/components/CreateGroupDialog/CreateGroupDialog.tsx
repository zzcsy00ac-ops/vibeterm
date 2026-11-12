/**
 * 创建分组对话框组件
 *
 * 简洁的单字段表单，用于创建 SSH 分组
 */

import * as Dialog from '@radix-ui/react-dialog';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSSHStore } from '../../store/sshStore';
import './CreateGroupDialog.css';

export interface CreateGroupDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 父分组 ID（创建子分组时使用） */
  parentGroupId?: string;
  /** 创建成功后的回调 */
  onSuccess?: (groupId: string) => void;
}

export const CreateGroupDialog = forwardRef<HTMLDivElement, CreateGroupDialogProps>(
  ({ open, onOpenChange, parentGroupId, onSuccess }, ref) => {
    const { t } = useTranslation();
    const addGroup = useSSHStore(state => state.addGroup);
    // 使用 useState 初始化，确保首次渲染时就有值
    const [portalContainer] = useState<HTMLDivElement | null>(() =>
      document.querySelector('.app-container') as HTMLDivElement
    );

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = formData.get('name') as string;

      if (!name || !name.trim()) {
        return;
      }

      try {
        const groupId = addGroup({
          name: name.trim(),
          parentId: parentGroupId || null,
        });

        // 重置表单
        e.currentTarget.reset();

        // 关闭对话框
        onOpenChange(false);

        // 触发成功回调
        onSuccess?.(groupId);
      } catch (error) {
        console.error('[CreateGroupDialog] Failed to create group:', error);
      }
    };

    const handleOpenChange = (open: boolean) => {
      // 如果正在关闭且表单有内容，可以添加确认逻辑
      onOpenChange(open);
    };

    return (
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal container={portalContainer || undefined}>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content create-group-dialog" ref={ref}>
            <Dialog.Title className="dialog-title">
              {parentGroupId ? t('ssh.dialogs.createSubgroup') : t('ssh.dialogs.createGroup')}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="dialog-form">
              <div className="form-field">
                <label htmlFor="group-name" className="form-label">
                  {t('ssh.form.groupName')} <span className="required">*</span>
                </label>
                <input
                  id="group-name"
                  name="name"
                  type="text"
                  className="form-input"
                  placeholder={t('ssh.form.groupNamePlaceholder')}
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
                  {t('ssh.buttons.create')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

CreateGroupDialog.displayName = 'CreateGroupDialog';
