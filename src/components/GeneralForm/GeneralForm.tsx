import { Flex, Select, Text, Card } from '@radix-ui/themes';
import { LanguageOptions, Language } from '../../schemas/settings';
import { useAppStore } from '../../store/appStore';
import { useProviderStore } from '../../store/providerStore';
import { useTranslation } from 'react-i18next';
import { useMemo, useCallback } from 'react';
import './GeneralForm.css';

export function GeneralForm() {
  const { t } = useTranslation();
  const { language, setLanguage, defaultProviderId, defaultModelId, setDefaultModel } = useAppStore();
  const { providers } = useProviderStore();

  // 获取配置了 API Key 的供应商（Ollama 不需要 API Key）
  const configuredProviders = useMemo(() => {
    return providers.filter(p => {
      if (p.apiType === 'ollama') {
        return p.models.length > 0;
      }
      return p.apiKey && p.models.length > 0;
    });
  }, [providers]);

  // 获取当前选中的供应商
  const currentProvider = useMemo(() => {
    return configuredProviders.find(p => p.id === defaultProviderId);
  }, [configuredProviders, defaultProviderId]);

  // 获取当前供应商的可用模型
  const availableModels = useMemo(() => {
    if (!currentProvider) return [];
    return currentProvider.models.filter(m => m.enabled !== false);
  }, [currentProvider]);

  // 处理语言变化
  const handleLanguageChange = useCallback((value: Language) => {
    setLanguage(value);
  }, [setLanguage]);

  // 处理供应商变化
  const handleProviderChange = useCallback((providerId: string) => {
    const provider = configuredProviders.find(p => p.id === providerId);
    if (!provider) return;

    // 选择该供应商的第一个可用模型
    const firstModel = provider.models.find(m => m.enabled !== false);
    if (firstModel) {
      setDefaultModel(providerId, firstModel.id);
    }
  }, [configuredProviders, setDefaultModel]);

  // 处理模型变化
  const handleModelChange = useCallback((modelId: string) => {
    if (defaultProviderId) {
      setDefaultModel(defaultProviderId, modelId);
    }
  }, [defaultProviderId, setDefaultModel]);

  return (
    <Flex direction="column" gap="4" className="general-form">
      {/* 语言设置 */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="bold">
              {t('settings.general.language')}
            </Text>
            <Text size="1" color="gray">
              {t('settings.general.languageDescription')}
            </Text>
          </Flex>

          <Select.Root
            value={language}
            onValueChange={handleLanguageChange}
          >
            <Select.Trigger placeholder={t('settings.selectPlaceholder')} />
            <Select.Content>
              <Select.Item value={LanguageOptions.Auto}>
                {t('settings.general.languageOption.auto')}
              </Select.Item>
              <Select.Item value={LanguageOptions.English}>
                {t('settings.general.languageOption.en')}
              </Select.Item>
              <Select.Item value={LanguageOptions.Chinese}>
                {t('settings.general.languageOption.cn')}
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Card>

      {/* 默认模型设置 */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="bold">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('settings.general.defaultModel')}
            </Text>
            <Text size="1" color="gray">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('settings.general.defaultModelDescription')}
            </Text>
          </Flex>

          {configuredProviders.length === 0 ? (
            <Text size="2" color="amber">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('settings.general.noProviderConfigured')}
            </Text>
          ) : (
            <>
              <Flex direction="row" gap="2" align="center">
                {/* 供应商选择 */}
                <Flex direction="column" gap="1" style={{ flex: 1 }}>
                  <Text size="1" color="gray">
                    {/* @ts-ignore - i18next 类型系统的限制 */}
                    {t('settings.general.provider')}
                  </Text>
                  <Select.Root
                    value={defaultProviderId || ''}
                    onValueChange={handleProviderChange}
                  >
                    {/* @ts-ignore - i18next 类型系统的限制 */}
                    <Select.Trigger placeholder={t('settings.general.selectProvider')} />
                    <Select.Content>
                      {configuredProviders.map(provider => (
                        <Select.Item key={provider.id} value={provider.id}>
                          {provider.name}
                          <Text size="1" color="gray" style={{ marginLeft: '4px' }}>
                            ({provider.apiType})
                          </Text>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>

                {/* 模型选择 */}
                <Flex direction="column" gap="1" style={{ flex: 1 }}>
                  <Text size="1" color="gray">
                    {/* @ts-ignore - i18next 类型系统的限制 */}
                    {t('settings.general.model')}
                  </Text>
                  <Select.Root
                    value={defaultModelId || ''}
                    onValueChange={handleModelChange}
                    disabled={!defaultProviderId || availableModels.length === 0}
                  >
                    {/* @ts-ignore - i18next 类型系统的限制 */}
                    <Select.Trigger placeholder={t('settings.general.selectModel')} />
                    <Select.Content>
                      {availableModels.map(model => (
                        <Select.Item key={model.id} value={model.id}>
                          {model.displayName || model.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
              </Flex>

              <Text size="1" color="gray">
                {/* @ts-ignore - i18next 类型系统的限制 */}
                {t('settings.general.defaultModelNote')}
              </Text>
            </>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
