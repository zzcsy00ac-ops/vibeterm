/**
 * 默认模型工具函数
 *
 * 提供获取默认模型的逻辑：
 * 1. 优先使用用户在设置中配置的默认模型
 * 2. 如果未配置或配置失效，回退到第一个可用模型
 */

import { useAppStore } from '../store/appStore';
import { useProviderStore } from '../store/providerStore';

/**
 * 默认模型信息
 */
export interface DefaultModel {
  providerId: string;
  modelId: string;
}

/**
 * 获取第一个可用的模型
 *
 * 遍历所有配置了 API Key 的供应商，返回第一个启用的模型
 */
export function getFirstAvailableModel(): DefaultModel | null {
  const { providers } = useProviderStore.getState();

  // 查找第一个配置了 API Key 且有启用模型的供应商
  for (const provider of providers) {
    if (!provider.apiKey) continue;

    // 查找第一个启用的模型
    const availableModel = provider.models.find(m => m.enabled !== false);
    if (availableModel) {
      return {
        providerId: provider.id,
        modelId: availableModel.id,
      };
    }
  }

  return null;
}

/**
 * 获取默认模型
 *
 * 优先级：
 * 1. 用户设置的默认模型（如果有效）
 * 2. 第一个可用的模型
 *
 * @returns 默认模型信息，如果没有可用模型则返回 null
 */
export function getDefaultModel(): DefaultModel | null {
  const { defaultProviderId, defaultModelId } = useAppStore.getState();
  const { providers } = useProviderStore.getState();

  // 1. 尝试使用用户设置的默认模型
  if (defaultProviderId && defaultModelId) {
    const provider = providers.find(p => p.id === defaultProviderId);

    // 验证供应商存在且配置了 API Key
    if (provider?.apiKey) {
      const model = provider.models.find(m => m.id === defaultModelId);

      // 验证模型存在且启用
      if (model && model.enabled !== false) {
        return {
          providerId: defaultProviderId,
          modelId: defaultModelId,
        };
      }
    }
  }

  // 2. 回退到第一个可用模型
  return getFirstAvailableModel();
}

/**
 * 验证默认模型是否有效
 *
 * 检查用户设置的默认模型是否仍然可用
 */
export function isDefaultModelValid(): boolean {
  const { defaultProviderId, defaultModelId } = useAppStore.getState();
  const { providers } = useProviderStore.getState();

  if (!defaultProviderId || !defaultModelId) {
    return false;
  }

  const provider = providers.find(p => p.id === defaultProviderId);
  if (!provider?.apiKey) {
    return false;
  }

  const model = provider.models.find(m => m.id === defaultModelId);
  return model != null && model.enabled !== false;
}

/**
 * 获取所有配置了 API Key 的供应商
 */
export function getConfiguredProviders() {
  const { providers } = useProviderStore.getState();
  return providers.filter(p => p.apiKey);
}
