/**
 * Model Provider 类型定义
 *
 * 定义 AI 模型供应商管理相关的数据结构
 */

// ==================== 基础类型 ====================

/**
 * API 类型枚举
 */
export type ApiType = 'openai' | 'anthropic' | 'ollama';

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型唯一 ID */
  id: string;
  /** 模型名称（用于 API 请求，如 "gpt-4"） */
  name: string;
  /** 显示名称（用于 UI 展示，可选） */
  displayName?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 上下文窗口大小（tokens），默认 128000 */
  contextWindow?: number;
}

// ==================== 供应商相关类型 ====================

/**
 * 模型供应商配置
 */
export interface ModelProvider {
  /** 供应商唯一 ID */
  id: string;
  /** 供应商名称（用户自定义） */
  name: string;
  /** 官网链接（可选） */
  officialUrl?: string;
  /** API Key */
  apiKey: string;
  /** 请求地址（API Base URL） */
  requestUrl: string;
  /** API 类型 */
  apiType: ApiType;
  /** 模型列表 */
  models: ModelConfig[];
  /** 所属分类 ID（null 表示未分类） */
  categoryId: string | null;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 创建供应商输入
 */
export interface CreateProviderInput {
  /** 供应商名称 */
  name: string;
  /** 官网链接（可选） */
  officialUrl?: string;
  /** API Key */
  apiKey: string;
  /** 请求地址 */
  requestUrl: string;
  /** API 类型 */
  apiType: ApiType;
  /** 模型列表 */
  models?: Omit<ModelConfig, 'id'>[];
  /** 所属分类 ID（可选） */
  categoryId?: string | null;
}

/**
 * 更新供应商输入
 */
export interface UpdateProviderInput {
  /** 供应商名称（可选） */
  name?: string;
  /** 官网链接（可选） */
  officialUrl?: string;
  /** API Key（可选） */
  apiKey?: string;
  /** 请求地址（可选） */
  requestUrl?: string;
  /** API 类型（可选） */
  apiType?: ApiType;
  /** 模型列表（可选） */
  models?: ModelConfig[];
  /** 所属分类 ID（可选） */
  categoryId?: string | null;
}

// ==================== 分类相关类型 ====================

/**
 * 供应商分类
 */
export interface ProviderCategory {
  /** 分类唯一 ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 父分类 ID（null 表示根分类） */
  parentId: string | null;
  /** 子分类 ID 列表 */
  children: string[];
  /** 供应商 ID 列表 */
  providers: string[];
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 创建分类输入
 */
export interface CreateCategoryInput {
  /** 分类名称 */
  name: string;
  /** 父分类 ID（可选，默认为根分类） */
  parentId?: string | null;
}
