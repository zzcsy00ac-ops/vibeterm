/**
 * Agent 服务 - 创建和管理 AI SDK Agent
 *
 * 使用 AI SDK 的 ToolLoopAgent 和 DirectChatTransport
 * 实现 OpenAI 和 Anthropic Provider 的动态创建
 * 集成 Tauri HTTP 插件以绕过 CORS 限制
 */

import { ToolLoopAgent, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider-v2';
import { fetch } from '@tauri-apps/plugin-http';
import type { ModelProvider, ModelConfig, ApiType } from '../types/provider';
import { toolRegistry, type ToolName } from './tools';
import { getAgentInstructions } from '../config/agentPrompt';

// ==================== Tauri fetch 封装 ====================

/**
 * Tauri fetch 封装
 *
 * 使用 Tauri HTTP 插件的 fetch 函数，绕过浏览器 CORS 限制
 */
const tauriFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  return fetch(input, init);
};

// ==================== 类型定义 ====================

/**
 * Token 使用统计
 */
export interface TokenUsageStats {
  /** 输入 token 数量 */
  inputTokens: number;
  /** 输出 token 数量 */
  outputTokens: number;
  /** 总 token 数量 */
  totalTokens: number;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Provider 配置 */
  provider: ModelProvider;
  /** 模型配置 */
  model: ModelConfig;
  /** 系统指令（可选） */
  instructions?: string;
  /** 选中的服务器 ID（可选） */
  selectedServerId?: string;
  /** 启用的工具列表（可选） */
  enabledTools?: ToolName[];
  /** 语言代码（可选），用于提示词国际化 */
  locale?: string;
  /** Token 使用统计回调 */
  onTokenUsage?: (usage: TokenUsageStats) => void;
}

/**
 * 创建 Agent 的结果
 */
export interface CreateAgentResult {
  /** Agent 实例 */
  agent: ToolLoopAgent<any, any, any>;
  /** 使用的语言模型 */
  model: LanguageModel;
  /** Provider 类型 */
  apiType: ApiType;
}

// ==================== 工具函数 ====================

/**
 * 创建 OpenAI Provider
 */
function createOpenAIProvider(provider: ModelProvider) {
  return createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.requestUrl,
    fetch: tauriFetch,
  });
}

/**
 * 创建 Anthropic Provider
 */
function createAnthropicProvider(provider: ModelProvider) {
  return createAnthropic({
    apiKey: provider.apiKey,
    baseURL: provider.requestUrl,
    fetch: tauriFetch,
  });
}

/**
 * 创建 Ollama Provider
 */
function createOllamaProvider(provider: ModelProvider) {
  return createOllama({
    baseURL: provider.requestUrl,
    fetch: tauriFetch,
  });
}


// ==================== 主要服务函数 ====================

/**
 * 根据配置创建 LanguageModel
 *
 * @param provider - Provider 配置
 * @param model - 模型配置
 * @returns LanguageModel 实例
 * @throws 如果 provider.apiType 无效
 */
export function createLanguageModel(
  provider: ModelProvider,
  model: ModelConfig
): LanguageModel {
  switch (provider.apiType) {
    case 'openai': {
      const openaiProvider = createOpenAIProvider(provider);
      return openaiProvider.chat(model.name);
    }

    case 'anthropic': {
      const anthropicProvider = createAnthropicProvider(provider);
      return anthropicProvider(model.name);
    }

    case 'ollama': {
      const ollamaProvider = createOllamaProvider(provider)
      return ollamaProvider(model.name)
    }

    default:
      throw new Error(`Unsupported API type: ${(provider as any).apiType}`);
  }
}

/**
 * 创建 ToolLoopAgent
 *
 * @param config - Agent 配置
 * @returns Agent 创建结果
 * @throws 如果配置无效
 */
export function createAgent(config: AgentConfig): CreateAgentResult {
  const { provider, model, instructions, enabledTools, locale } = config;

  // 验证配置
  if (!provider.requestUrl) {
    throw new Error('Provider request URL is required');
  }
  if (!model.name) {
    throw new Error('Model name is required');
  }

  // Ollama 不需要 API Key
  if (provider.apiType !== 'ollama' && !provider.apiKey) {
    throw new Error('Provider API key is required');
  }

  // 创建 LanguageModel
  const languageModel = createLanguageModel(provider, model);

  // 获取系统指令
  const defaultInstructions = getAgentInstructions(instructions, locale);

  // 手动过滤工具对象，只包含启用的工具
  const filteredTools: Record<string, any> = {};
  if (enabledTools && enabledTools.length > 0) {
    for (const toolName of enabledTools) {
      if (toolRegistry[toolName]) {
        filteredTools[toolName] = toolRegistry[toolName];
      }
    }
  }

  // 创建 ToolLoopAgent，只传递启用的工具
  const agent = new ToolLoopAgent({
    model: languageModel,
    instructions: defaultInstructions,
    tools: toolRegistry,  // 只包含启用的工具
    activeTools:enabledTools,
    toolChoice: Object.keys(filteredTools).length > 0 ? 'auto' : 'none',
    prepareStep: ({ messages }) => {
      console.log('prepareStep',messages,enabledTools)
      return {
        messages: messages.map(msg => {
          // 非助手消息或非数组内容，直接返回
          if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
            return msg;
          }

          // 过滤工具调用/结果，只保留启用的工具
          return {
            ...msg,
            content: msg.content.filter(item => {
              const isToolItem = item.type === 'tool-call' || item.type === 'tool-result';

              // 非工具内容保留，工具内容检查是否启用
              return !isToolItem || enabledTools?.includes(item.toolName as ToolName);
            }),
          };
        }),
      };
    },
    onFinish: ({ totalUsage }) => {
      const stats: TokenUsageStats = {
        inputTokens: totalUsage.inputTokens || 0,
        outputTokens: totalUsage.outputTokens || 0,
        totalTokens: totalUsage.totalTokens || 0
      };

      // 调用回调函数传递统计数据
      config.onTokenUsage?.(stats);

      console.log('Token 统计', stats);
    }
  });

  return {
    agent,
    model: languageModel,
    apiType: provider.apiType,
  };
}

/**
 * 批量创建 Agent（用于多个会话）
 *
 * @param configs - Agent 配置数组
 * @returns Agent 创建结果数组
 */
export function createAgents(configs: AgentConfig[]): CreateAgentResult[] {
  return configs.map((config) => createAgent(config));
}

// ==================== 工具函数 ====================

/**
 * 验证 Provider 配置是否有效
 *
 * @param provider - Provider 配置
 * @returns 是否有效
 */
export function isValidProvider(provider: ModelProvider): boolean {
  const hasApiType = provider.apiType && ['openai', 'anthropic', 'ollama'].includes(provider.apiType);
  const hasRequestUrl = provider.requestUrl;

  // Ollama 不需要 API Key
  if (provider.apiType === 'ollama') {
    return !!(hasApiType && hasRequestUrl);
  }

  // OpenAI 和 Anthropic 需要 API Key
  return !!(provider.apiKey && hasRequestUrl && hasApiType);
}

/**
 * 验证模型配置是否有效
 *
 * @param model - 模型配置
 * @returns 是否有效
 */
export function isValidModel(model: ModelConfig): boolean {
  return !!(model.name && model.id);
}

/**
 * 获取 Provider 的显示名称
 *
 * @param provider - Provider 配置
 * @returns 显示名称
 */
export function getProviderDisplayName(provider: ModelProvider): string {
  return provider.name || provider.requestUrl;
}

/**
 * 获取模型的显示名称
 *
 * @param model - 模型配置
 * @returns 显示名称
 */
export function getModelDisplayName(model: ModelConfig): string {
  return model.displayName || model.name;
}

// ==================== 类型导出 ====================

export type { ToolLoopAgent };
