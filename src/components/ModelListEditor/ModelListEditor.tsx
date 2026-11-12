/**
 * 模型列表编辑器组件
 *
 * 用于编辑供应商的模型列表，支持启用/禁用切换和删除操作
 */

import { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import * as Switch from '@radix-ui/react-switch';
import { Plus, Trash2 } from 'lucide-react';
import type { ModelConfig } from '../../types/provider';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import './ModelListEditor.css';

// 懒加载添加模型对话框
const AddModelDialog = lazy(() => import('../AddModelDialog/AddModelDialog').then(m => ({ default: m.AddModelDialog })));

export interface ModelListEditorProps {
  /** 模型列表 */
  models: ModelConfig[];
  /** 模型列表变化回调 */
  onChange: (models: ModelConfig[]) => void;
}

function ModelListEditor({ models, onChange }: ModelListEditorProps) {
  const { t } = useTranslation();
  const [showAddDialog, setShowAddDialog] = useState(false);

  // 切换模型启用状态
  const handleToggle = (modelId: string, enabled: boolean) => {
    onChange(
      models.map((m) => (m.id === modelId ? { ...m, enabled } : m))
    );
  };

  // 删除模型
  const handleRemove = (modelId: string) => {
    onChange(models.filter((m) => m.id !== modelId));
  };

  // 添加模型
  const handleAddModel = (newModel: Omit<ModelConfig, 'id'>) => {
    const modelWithId: ModelConfig = {
      ...newModel,
      id: crypto.randomUUID(),
    };
    onChange([...models, modelWithId]);
  };

  return (
    <>
      <div className="model-list-editor">
        {models.length === 0 ? (
          <div className="model-list-empty">
            {/* @ts-ignore - i18next 类型系统的限制 */}
            <p>{t('provider.model.empty')}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus size={16} />
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('provider.model.addModel')}
            </button>
          </div>
        ) : (
          <div className="model-list-items">
            {models.map((model) => (
              <div key={model.id} className="model-item">
                <div className="model-item-info">
                  <span className="model-item-name">
                    {model.displayName || model.name}
                  </span>
                  {model.displayName && model.displayName !== model.name && (
                    <span className="model-item-id">{model.name}</span>
                  )}
                </div>
                <div className="model-item-actions">
                  <Switch.Root
                    className="switch"
                    checked={model.enabled}
                    onCheckedChange={(checked) => handleToggle(model.id, checked)}
                  >
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                  <button
                    type="button"
                    className="btn-icon btn-icon-danger"
                    onClick={() => handleRemove(model.id)}
                    // @ts-ignore - i18next 类型系统的限制
                    title={t('provider.model.removeModel')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-add-model"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus size={16} />
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('provider.model.addModel')}
            </button>
          </div>
        )}
      </div>

      {showAddDialog && (
        <Suspense fallback={<LoadingSpinner message="加载对话框..." />}>
          <AddModelDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onAdd={handleAddModel}
          />
        </Suspense>
      )}
    </>
  );
}

export { ModelListEditor };
