/**
 * Chat 聊天会话管理 Store
 *
 * 使用 Zustand + TauriStoreState 实现持久化和多窗口同步
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TauriStoreState } from './tauriStoreState';
import { storeSave } from '../command';
import type { UIMessage } from 'ai';
import { toolRegistry, type ToolName } from '../services/tools';

// ==================== 类型定义 ====================

/**
 * Token 使用明细
 */
export interface TokenUsageDetail {
  /** 最后一次请求的输入大小 */
  inputTokens: number;
  /** 最后一次请求的输出大小 */
  outputTokens: number;
  /** 最后一次请求的总大小 */
  totalTokens: number;
  /** 记录时间 */
  timestamp: number;
}

/**
 * 聊天会话
 */
export interface Conversation {
  /** 会话 ID */
  id: string;
  /** 会话标题（默认使用第一条用户消息的前 50 个字符） */
  title: string;
  /** 模型 ID */
  modelId: string;
  /** Provider ID */
  providerId: string;
  /** 消息列表（使用 AI SDK 的 UIMessage 格式） */
  messages: UIMessage[];
  /** 启用的工具列表（默认为所有工具） */
  enabledTools?: ToolName[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 会话累计消耗的总 token 数 */
  totalTokens?: number;
  /** 最后一次请求的 token 使用明细 */
  lastTokenUsage?: TokenUsageDetail;
}

/**
 * 创建会话输入
 */
export interface CreateConversationInput {
  /** 模型 ID */
  modelId: string;
  /** Provider ID */
  providerId: string;
  /** 初始标题（可选，默认使用第一条消息生成） */
  title?: string;
  /** 启用的工具列表（可选，默认为所有工具） */
  enabledTools?: ToolName[];
}

/**
 * 更新会话输入
 */
export interface UpdateConversationInput {
  title?: string;
  modelId?: string;
  providerId?: string;
  /** 启用的工具列表 */
  enabledTools?: ToolName[];
  /** 会话累计消耗的总 token 数 */
  totalTokens?: number;
  /** 最后一次请求的 token 使用明细 */
  lastTokenUsage?: TokenUsageDetail;
}

// ==================== Store 类型 ====================

interface ChatStore {
  // ========== 状态 ==========
  /** 所有会话（使用对象实现 O(1) 查找） */
  conversations: Record<string, Conversation>;
  /** 当前活跃的会话 ID */
  activeConversationId: string | null;

  // ========== 会话 CRUD ==========
  /** 创建新会话 */
  createConversation: (input: CreateConversationInput) => string;
  /** 删除会话 */
  deleteConversation: (id: string) => void;
  /** 更新会话 */
  updateConversation: (id: string, input: UpdateConversationInput) => void;
  /** 获取单个会话 */
  getConversation: (id: string) => Conversation | undefined;
  /** 获取所有会话 */
  getAllConversations: () => Conversation[];

  // ========== 活跃会话管理 ==========
  /** 设置活跃会话 */
  setActiveConversation: (id: string | null) => void;
  /** 获取活跃会话 */
  getActiveConversation: () => Conversation | undefined;

  // ========== 消息管理 ==========
  /** 添加消息到会话 */
  addMessage: (conversationId: string, message: UIMessage) => void;
  /** 获取会话的所有消息 */
  getMessages: (conversationId: string) => UIMessage[];
  /** 清空会话消息（保留会话） */
  clearMessages: (conversationId: string) => void;
  /** 设置会话的消息列表（用于批量更新） */
  setMessages: (conversationId: string, messages: UIMessage[]) => void;

  // ========== 查询 ==========
  /** 根据 Provider ID 获取会话列表 */
  getConversationsByProvider: (providerId: string) => Conversation[];
  /** 根据 Model ID 获取会话列表 */
  getConversationsByModel: (modelId: string) => Conversation[];
}

// ==================== 工具函数 ====================

/**
 * 从用户消息生成会话标题
 */
function generateTitleFromMessage(message: string, maxLength: number = 50): string {
  // 移除多余空格和换行
  const cleaned = message.trim().replace(/\s+/g, ' ');
  // 截取前 N 个字符
  const truncated = cleaned.slice(0, maxLength);
  // 如果被截断，添加省略号
  return cleaned.length > maxLength ? `${truncated}...` : truncated;
}

/**
 * 生成默认会话值
 */
function getDefaultConversationValues(): Omit<Conversation, 'id' | 'modelId' | 'providerId' | 'title'> {
  return {
    messages: [],
    enabledTools: Object.keys(toolRegistry) as ToolName[],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ==================== 创建存储实例 ====================

// 保存 rehydrate 方法的引用，用于在收到事件时触发
let rehydrateFn: (() => void) | null = null;

const tauriStore = new TauriStoreState('chat-store.json', {
  // 数据重新加载时的回调（多窗口同步时触发）
  onRehydrate: () => {
    rehydrateFn?.();
  },

  // 防抖延迟时间（毫秒）
  debounce: 100,

  // 自定义保存函数，实现多窗口同步
  saveFn: async (currentWindow, storeName) => {
    try {
      await storeSave(storeName, currentWindow.label);
    } catch (error) {
      console.error('[ChatStore] Failed to save store:', error);
    }
  },
});

// ==================== 初始化存储 ====================

// 确保 store 初始化完成
await tauriStore.init();

// ==================== 创建 Store ====================

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      conversations: {},
      activeConversationId: null,

      // ========== 会话 CRUD ==========

      createConversation: (input) => {
        const newConversation: Conversation = {
          ...getDefaultConversationValues(),
          ...input,
          // 如果没有提供标题，使用默认标题
          title: input.title || 'New Chat',
          id: crypto.randomUUID(),
        };

        set((state) => ({
          conversations: {
            ...state.conversations,
            [newConversation.id]: newConversation,
          },
          // 自动设置为新创建的会话为活跃会话
          activeConversationId: newConversation.id,
        }));

        return newConversation.id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const { [id]: removed, ...remaining } = state.conversations;
          // 如果删除的是活跃会话，清空活跃状态
          const newActiveId = state.activeConversationId === id ? null : state.activeConversationId;
          return {
            conversations: remaining,
            activeConversationId: newActiveId,
          };
        });
      },

      updateConversation: (id, input) => {
        set((state) => {
          const conversation = state.conversations[id];
          if (!conversation) {
            console.warn('[ChatStore] Conversation not found:', id);
            return state;
          }
          return {
            conversations: {
              ...state.conversations,
              [id]: { ...conversation, ...input, updatedAt: Date.now() },
            },
          };
        });
      },

      getConversation: (id) => {
        return get().conversations[id];
      },

      getAllConversations: () => {
        return Object.values(get().conversations);
      },

      // ========== 活跃会话管理 ==========

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      getActiveConversation: () => {
        const state = get();
        if (!state.activeConversationId) return undefined;
        return state.conversations[state.activeConversationId];
      },

      // ========== 消息管理 ==========

      addMessage: (conversationId, message) => {
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) {
            console.warn('[ChatStore] Conversation not found:', conversationId);
            return state;
          }

          // 从 UIMessage 的第一个 text part 提取文本用于标题生成
          let titleUpdate = {};
          if (conversation.messages.length === 0 && message.role === 'user') {
            const textPart = message.parts.find((p: any) => p.type === 'text');
            if (textPart && 'text' in textPart) {
              titleUpdate = { title: generateTitleFromMessage(textPart.text) };
            }
          }

          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conversation,
                ...titleUpdate,
                messages: [...conversation.messages, message],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      getMessages: (conversationId) => {
        return get().conversations[conversationId]?.messages || [];
      },

      clearMessages: (conversationId) => {
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) {
            console.warn('[ChatStore] Conversation not found:', conversationId);
            return state;
          }
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conversation,
                messages: [],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setMessages: (conversationId, messages) => {
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) {
            console.warn('[ChatStore] Conversation not found:', conversationId);
            return state;
          }
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conversation,
                messages,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // ========== 查询 ==========

      getConversationsByProvider: (providerId) => {
        return Object.values(get().conversations).filter((c) => c.providerId === providerId);
      },

      getConversationsByModel: (modelId) => {
        return Object.values(get().conversations).filter((c) => c.modelId === modelId);
      },
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => tauriStore),
    }
  )
);

// 保存 rehydrate 方法供后续使用
rehydrateFn = (useChatStore as any).persist?.rehydrate;

// ==================== 类型导出 ====================

export type { ChatStore };
