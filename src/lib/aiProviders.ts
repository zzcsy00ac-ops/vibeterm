/**
 * AI SDK Provider 工厂函数
 *
 * 集成 Tauri HTTP 插件，为 OpenAI 和 Anthropic 提供 CORS 绕过能力
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { fetch } from '@tauri-apps/plugin-http';
import type { LanguageModel } from 'ai';
import type { ModelProvider } from '../types/provider';

/**
 * Tauri fetch 封装
 *
 * 使用 Tauri HTTP 插件的 fetch 函数，绕过浏览器 CORS 限制
 *
 * @param input - 请求 URL 或 Request 对象
 * @param init - 请求配置（method, headers, body 等）
 * @returns Response 对象
 */
const tauriFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  // 提取 URL 用于日志
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  console.log('[AI Provider] HTTP Request:', {
    url,
    method: init?.method || 'GET',
  });

  try {
    // 使用 Tauri fetch 代替全局 fetch
    const response = await fetch(input, init);

    console.log('[AI Provider] HTTP Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
    });

    return response;
  } catch (error) {
    console.error('[AI Provider] HTTP Request failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 创建 AI SDK Provider 实例
 *
 * 根据供应商类型（OpenAI/Anthropic）创建对应的 AI SDK Provider，
 * 自动注入 Tauri fetch 实现。
 *
 * @param provider - 供应商配置（包含 API Key、Base URL 等）
 * @returns AI SDK Provider 函数
 *
 * @example
 * ```typescript
 * const provider = createAIProvider({
 *   apiType: 'openai',
 *   apiKey: 'sk-...',
 *   requestUrl: 'https://api.openai.com/v1',
 *   // ...
 * });
 *
 * const model = provider('gpt-4');
 * ```
 */
export function createAIProvider(provider: ModelProvider) {
  switch (provider.apiType) {
    case 'openai': {
      return createOpenAI({
        baseURL: provider.requestUrl,
        apiKey: provider.apiKey,
        fetch: tauriFetch,
      });
    }

    case 'anthropic': {
      return createAnthropic({
        baseURL: provider.requestUrl,
        apiKey: provider.apiKey,
        fetch: tauriFetch,
      });
    }

    default:
      throw new Error(
        `Unsupported API type: ${
          (provider as ModelProvider).apiType
        }. Supported types are: 'openai', 'anthropic'`
      );
  }
}

/**
 * 创建 Language Model 实例
 *
 * 这是创建 AI 模型实例的便捷函数，封装了 Provider 创建过程。
 *
 * @param provider - 供应商配置
 * @param modelName - 模型名称（如 "gpt-4", "claude-3-opus-20240229"）
 * @returns AI SDK Language Model 实例
 *
 * @example
 * ```typescript
 * const model = createLanguageModel(provider, 'gpt-4');
 *
 * // 与 streamText 一起使用
 * const result = await streamText({
 *   model,
 *   prompt: 'Tell me a story',
 * });
 * ```
 */
export function createLanguageModel(
  provider: ModelProvider,
  modelName: string
): LanguageModel {
  const aiProvider = createAIProvider(provider);
  return aiProvider(modelName);
}
