/**
 * 添加模型对话框组件
 *
 * 用于添加新的模型配置到供应商
 */

import { forwardRef, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { ModelConfig } from '../../types/provider';
import './AddModelDialog.css';

export interface AddModelDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 对话框打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 添加模型回调 */
  onAdd: (model: Omit<ModelConfig, 'id'>) => void;
}

export const AddModelDialog = forwardRef<HTMLDivElement, AddModelDialogProps>(
  ({ open, onOpenChange, onAdd }, ref) => {
    const { t } = useTranslation();
    // 使用 lazy initial state 确保首次渲染时就能获取到容器
    const [portalContainer] = useState<HTMLElement | null>(() =>
      document.querySelector('.app-container') as HTMLElement
    );
    const [modelId, setModelId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [contextWindow, setContextWindow] = useState('');
    const [enabled, setEnabled] = useState(true);

    // 重置表单
    const resetForm = () => {
      setModelId('');
      setDisplayName('');
      setContextWindow('');
      setEnabled(true);
    };

    // 对话框关闭时重置表单
    useEffect(() => {
      if (!open) {
        resetForm();
      }
    }, [open]);

    // 处理提交
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡到父表单

      if (!modelId.trim()) {
        return;
      }

      onAdd({
        name: modelId.trim(),
        displayName: displayName.trim() || undefined,
        contextWindow: contextWindow ? (parseInt(contextWindow, 10) || 0) * 1000 : undefined,
        enabled,
      });

      resetForm();
      onOpenChange(false);
    };

    // 处理取消
    const handleCancel = () => {
      resetForm();
      onOpenChange(false);
    };

    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={portalContainer || undefined}>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="add-model-dialog-content" ref={ref}>
            <Dialog.Title className="dialog-title">
              {t('provider.model.addTitle')}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="dialog-form">
              {/* 模型 ID */}
              <div className="form-field">
                <label className="form-label" htmlFor="model-id">
                  {t('provider.model.modelId')} <span className="required">*</span>
                </label>
                <input
                  id="model-id"
                  type="text"
                  className="form-input"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. gpt-4, claude-3-opus"
                  required
                  autoFocus
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <span className="form-hint">
                  {t('provider.model.modelIdPlaceholder')}
                </span>
              </div>

              {/* 显示名称 */}
              <div className="form-field">
                <label className="form-label" htmlFor="display-name">
                  {t('provider.model.displayName')}
                </label>
                <input
                  id="display-name"
                  type="text"
                  className="form-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('provider.model.displayNamePlaceholder')}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <span className="form-hint">{t('provider.model.optional')}</span>
              </div>

              {/* Context Window */}
              <div className="form-field">
                <label className="form-label" htmlFor="context-window">
                  {(t as any)('provider.model.contextWindow')}
                </label>
                <input
                  id="context-window"
                  type="number"
                  className="form-input"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                  placeholder={(t as any)('provider.model.contextWindowPlaceholder')}
                  min="1"
                  step="1"
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <span className="form-hint">{t('provider.model.optional')}</span>
              </div>

              {/* 默认启用 */}
              <div className="form-field checkbox-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span>{t('provider.model.enabledByDefault')}</span>
                </label>
              </div>

              {/* 按钮 */}
              <div className="dialog-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  {t('common.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('common.buttons.add')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

AddModelDialog.displayName = 'AddModelDialog';
