/**
 * 供应商配置对话框组件
 *
 * 用于创建或编辑模型供应商配置
 */

import {
  forwardRef,
  useEffect,
  useState,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import type { ModelProvider, ApiType, ModelConfig } from '../../types/provider';
import { ModelListEditor } from '../ModelListEditor/ModelListEditor';
import './ProviderDialog.css';

export interface ProviderDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 对话框打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 对话框模式：创建或编辑 */
  mode: 'create' | 'edit';
  /** 初始数据（编辑模式时传入） */
  initialData?: ModelProvider;
  /** 提交回调 */
  onSubmit?: (data: Omit<ModelProvider, 'id' | 'createdAt' | 'updatedAt' | 'categoryId'>) => void;
}

const ProviderDialog = forwardRef<HTMLDivElement, ProviderDialogProps>(
  ({ open, onOpenChange, mode, initialData, onSubmit }, ref) => {
    const { t } = useTranslation();
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    // 表单状态
    const [name, setName] = useState('');
    const [officialUrl, setOfficialUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [requestUrl, setRequestUrl] = useState('');
    const [apiType, setApiType] = useState<ApiType>('openai');
    const [showApiKey, setShowApiKey] = useState(false);
    const [models, setModels] = useState<ModelConfig[]>([]);

    // 获取 .app-container 作为 Portal 挂载点
    useEffect(() => {
      const container = document.querySelector('.app-container') as HTMLElement;
      setPortalContainer(container);
    }, []);

    // 编辑模式：填充初始数据
    useEffect(() => {
      if (mode === 'edit' && initialData) {
        setName(initialData.name);
        setOfficialUrl(initialData.officialUrl || '');
        setApiKey(initialData.apiKey);
        setRequestUrl(initialData.requestUrl);
        setApiType(initialData.apiType);
        setModels(initialData.models || []);
      } else if (mode === 'create' && open) {
        // 仅在打开时重置
        resetForm();
      }
    }, [mode, initialData, open]);

    // 当对话框关闭时重置表单（处理点击 Overlay 或 ESC 关闭的情况）
    useEffect(() => {
      if (!open) {
        resetForm();
      }
    }, [open]);

    // 重置表单
    const resetForm = () => {
      setName('');
      setOfficialUrl('');
      setApiKey('');
      setRequestUrl('');
      setApiType('openai');
      setShowApiKey(false);
      setModels([]);
    };

    // 处理提交
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const formData = {
        name: name.trim(),
        officialUrl: officialUrl.trim() || undefined,
        apiKey: apiKey.trim(),
        requestUrl: requestUrl.trim(),
        apiType,
        models,
      };

      onSubmit?.(formData as any);
      resetForm();
      onOpenChange(false);
    };

    // 处理取消
    const handleCancel = () => {
      resetForm();
      onOpenChange(false);
    };

    const dialogTitle =
      mode === 'create' ? t('provider.dialogs.addProvider') : t('provider.dialogs.editProvider');

    // Ollama 不需要 API Key
    const isFormValid =
      name.trim() !== '' &&
      (apiType === 'ollama' || apiKey.trim() !== '') &&
      requestUrl.trim() !== '' &&
      models.length > 0;

    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={portalContainer || undefined}>
          <Dialog.Overlay className="provider-dialog-overlay" />
          <Dialog.Content
            className="provider-dialog-content"
            ref={ref}
            onInteractOutside={(event: Event) => event.preventDefault()}
          >
            <Dialog.Title className="dialog-title">{dialogTitle}</Dialog.Title>

            <form id="provider-form" onSubmit={handleSubmit} className="dialog-form">
              <div className="dialog-scrollable-content">
                {/* 供应商名称 */}
                <div className="form-field">
                  <label className="form-label" htmlFor="provider-name">
                    {t('provider.form.providerName')} <span className="required">*</span>
                  </label>
                  <input
                    id="provider-name"
                    name="name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. OpenAI GPT-4"
                    required
                    autoFocus
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>

                {/* 官网链接 */}
                <div className="form-field">
                  <label className="form-label" htmlFor="official-url">
                    {t('provider.form.officialUrl')}
                  </label>
                  <input
                    id="official-url"
                    name="officialUrl"
                    type="url"
                    className="form-input"
                    value={officialUrl}
                    onChange={(e) => setOfficialUrl(e.target.value)}
                    placeholder="https://openai.com"
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>

                {/* API Key */}
                {apiType !== 'ollama' && (
                  <div className="form-field">
                    <label className="form-label" htmlFor="api-key">
                      {t('provider.form.apiKey')} <span className="required">*</span>
                    </label>
                    <div className="input-with-action">
                      <input
                        id="api-key"
                        name="apiKey"
                        type={showApiKey ? 'text' : 'password'}
                        className="form-input"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        required={(apiType as ApiType) !== 'ollama'}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? 'Hide' : 'Show'}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* 请求地址 */}
                <div className="form-field">
                  <label className="form-label" htmlFor="request-url">
                    {t('provider.form.requestUrl')} <span className="required">*</span>
                  </label>
                  <input
                    id="request-url"
                    name="requestUrl"
                    type="url"
                    className="form-input"
                    value={requestUrl}
                    onChange={(e) => setRequestUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    required
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>

                {/* 接口类型 */}
                <div className="form-field">
                  <label className="form-label" htmlFor="api-type">
                    {t('provider.form.apiType')} <span className="required">*</span>
                  </label>
                  <Select.Root value={apiType} onValueChange={(value: ApiType) => setApiType(value)}>
                    <Select.Trigger className="select-trigger" id="api-type">
                      <Select.Value />
                      <Select.Icon className="select-icon">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </svg>
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal container={portalContainer || undefined}>
                      <Select.Content className="select-content">
                        <Select.Viewport className="select-viewport">
                          <Select.Item value="openai" className="select-item">
                            <Select.ItemText>{t('provider.apiTypes.openai')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="anthropic" className="select-item">
                            <Select.ItemText>{t('provider.apiTypes.anthropic')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="ollama" className="select-item">
                            <Select.ItemText>{t('provider.apiTypes.ollama') || 'Ollama'}</Select.ItemText>
                          </Select.Item>
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                {/* 模型列表 */}
                <div className="form-field">
                  <label className="form-label">
                    {t('provider.form.models')} <span className="required">*</span>
                  </label>
                  <ModelListEditor models={models} onChange={setModels} />
                  {models.length === 0 && (
                    <span className="form-error">{t('provider.validation.atLeastOneModel')}</span>
                  )}
                </div>
              </div>
            </form>

            {/* 按钮 - 固定在底部 */}
            <div className="dialog-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                {t('common.buttons.cancel')}
              </button>
              <button
                type="submit"
                form="provider-form"
                className="btn btn-primary"
                disabled={!isFormValid}
              >
                {mode === 'create' ? t('common.buttons.create') : t('common.buttons.save')}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

ProviderDialog.displayName = 'ProviderDialog';

export { ProviderDialog };
