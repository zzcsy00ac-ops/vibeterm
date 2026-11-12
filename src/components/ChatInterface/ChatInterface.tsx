/**
 * ChatInterface - 聊天界面组件（核心）
 *
 * 功能：
 * - 显示消息列表
 * - 消息输入和发送
 * - 流式响应动画
 * - 模型选择器
 * - 自动滚动
 */

import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  Bot,
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DirectChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai';
import { useState, useMemo, useRef, useCallback, startTransition, useEffect } from 'react';
import { ErrorBanner } from '../ErrorBanner/ErrorBanner';
import { useChatStore } from '../../store/chatStore';
import { useProviderStore } from '../../store/providerStore';
import { useSSHStore } from '../../store/sshStore';
import { usePermissionStore } from '../../store/permissionStore';
import { createAgent, type TokenUsageStats } from '../../services/agentService';
import { toolRegistry, type ToolName } from '../../services/tools';
import type { TokenUsageDetail } from '../../store/chatStore';
import { useShallow } from 'zustand/shallow';
import { ChatInput } from './ChatInput';
import { VirtualMessageList } from './VirtualMessageList';
import './ChatInterface.css';

interface ChatInterfaceProps {
  chatId?: string;
  /** 临时会话的 Provider ID */
  ephemeralProviderId?: string;
  /** 临时会话的 Model ID */
  ephemeralModelId?: string;
}

export function ChatInterface({
  chatId,
  ephemeralProviderId,
  ephemeralModelId,
}: ChatInterfaceProps) {
  const { t, i18n } = useTranslation();

  // 临时聊天的工具选择状态（本地管理，不持久化）
  const [ephemeralEnabledTools, setEphemeralEnabledTools] = useState<ToolName[]>(
    Object.keys(toolRegistry) as ToolName[]
  );

  // 临时聊天的 Provider 和 Model 状态（本地管理，不持久化）
  const [ephemeralProviderIdState, setEphemeralProviderIdState] = useState<string | undefined>(
    ephemeralProviderId
  );
  const [ephemeralModelIdState, setEphemeralModelIdState] = useState<string | undefined>(
    ephemeralModelId
  );

  // 临时聊天的消息状态（本地管理，避免工具变化导致消息清空）
  const [ephemeralMessages, setEphemeralMessages] = useState<UIMessage[]>([]);

  // ✅ 临时聊天的 token 统计状态（本地管理，不持久化）
  const [ephemeralTotalTokens, setEphemeralTotalTokens] = useState<number>(0);
  const [ephemeralLastTokenUsage, setEphemeralLastTokenUsage] = useState<TokenUsageDetail | null>(null);

  // ✅ 使用 ref 存储 token 统计数据，避免触发重渲染（rerender-defer-reads）
  // 注意：使用 agentService 的 TokenUsageStats 类型接收回调数据
  const lastTokenUsageRef = useRef<TokenUsageStats | null>(null);

  // 错误状态
  const [lastError, setLastError] = useState<Error | null>(null);
  const [showError, setShowError] = useState(false);

  // Store
  const { updateConversation, setMessages } = useChatStore(
    useShallow((state) => ({
      updateConversation: state.updateConversation,
      setMessages: state.setMessages,
    }))
  );

  // 判断是否为临时会话（ephemeral- 开头的 chatId）
  const isEphemeral = chatId?.startsWith('ephemeral-') || !chatId;

  // 优化：仅订阅当前活跃的会话，避免其他对话变化触发重渲染
  const activeConversation = useChatStore((state) => {
    if (!chatId || isEphemeral) return null;
    return state.conversations[chatId] || null;
  });
  const { providers } = useProviderStore();
  const sshProfiles = useSSHStore((state) => state.profiles);
  const setActiveChatId = usePermissionStore((state) => state.setActiveChatId);

  // 当 chatId 变化时，更新权限 Store 的活跃会话 ID
  useEffect(() => {
    setActiveChatId(chatId || null);
  }, [chatId, setActiveChatId]);

  // 获取 provider (简单查找，不需要 useMemo - Rule 5.2)
  const currentProvider = useMemo(() => {
    if (isEphemeral && ephemeralProviderIdState) {
      return providers.find((p) => p.id === ephemeralProviderIdState) || null;
    }
    return activeConversation
      ? providers.find((p) => p.id === activeConversation.providerId)
      : null;
  }, [isEphemeral, ephemeralProviderIdState, activeConversation, providers]);

  // 获取 model (简单查找，不需要 useMemo - Rule 5.2)
  const currentModel = useMemo(() => {
    if (!currentProvider) return null;
    if (isEphemeral && ephemeralModelIdState) {
      return currentProvider.models.find((m) => m.id === ephemeralModelIdState) || null;
    }
    return activeConversation
      ? currentProvider.models.find((m) => m.id === activeConversation.modelId)
      : currentProvider.models[0] || null;
  }, [currentProvider, isEphemeral, ephemeralModelIdState, activeConversation]);

  // 从 conversations 中获取消息（简单数组选择，不需要 useMemo - Rule 5.2)
  // 临时会话使用本地消息状态，普通会话从 store 加载
  const storedMessages: UIMessage[] = isEphemeral ? ephemeralMessages : (activeConversation?.messages || []);

  // 统一的工具列表：临时聊天用本地状态，普通聊天用 store 配置
  const currentEnabledTools = isEphemeral
    ? ephemeralEnabledTools
    : (activeConversation?.enabledTools || Object.keys(toolRegistry) as ToolName[]);

  // 计算 chat ID（包含 modelId 和 enabledTools），确保模型或工具切换时重新初始化
  // 临时聊天现在使用本地消息管理，所以可以安全地包含 enabledToolsKey
  const enabledToolsKey = isEphemeral
    ? ephemeralEnabledTools.sort().join(',')
    : (activeConversation?.enabledTools?.sort().join(',') || 'all');
  const chatIdWithModel = isEphemeral
    ? `${chatId}-${ephemeralModelIdState || 'default'}-${enabledToolsKey}`  // 临时聊天也包含工具信息
    : activeConversation
    ? `${chatId}-${activeConversation.modelId}-${enabledToolsKey}`
    : chatId || 'default';

  // 创建 Agent
  const agent = useMemo(() => {
    if (!currentProvider || !currentModel) return null;
    try {
      // 使用会话配置的工具，如果没有配置则启用所有工具
      const enabledTools = currentEnabledTools;
      const { agent: createdAgent } = createAgent({
        provider: currentProvider,
        model: currentModel,
        enabledTools,
        locale: i18n.language,
        onTokenUsage: (usage) => {
          // ✅ 直接更新 ref，不触发重渲染
          lastTokenUsageRef.current = usage;
        }
      });
      return createdAgent;
    } catch (error) {
      console.error('[ChatInterface] Failed to create agent:', error);
      return null;
    }
  }, [currentProvider, currentModel, currentEnabledTools, isEphemeral]);

  // 缓存每个会话的最新消息，用于 transport
  // 使用 ref 确保总是能获取到最新的消息，同时不触发 transport 重建
  const messagesRef = useRef<UIMessage[]>([]);
  messagesRef.current = storedMessages;

  // 创建 DirectChatTransport，启用持久化模式
  // 注意：transport 使用 ref 中的最新消息，但只在 agent 或 chatId 变化时重建
  const transport = useMemo(() => {
    if (!agent) return undefined;
    return new DirectChatTransport({
      agent,
      // originalMessages: messagesRef.current as any,
      // generateMessageId: createIdGenerator({
      //   prefix: `${Date.now()}`,
      //   size: 16,
      // }),
    }) as any;
  }, [agent, isEphemeral]);  // 移除 chatId 依赖，避免工具变化导致 transport 重建（临时聊天需要）
  // useChat hook - 必须无条件调用
  const { messages, sendMessage, status, addToolApprovalResponse, stop, regenerate, clearError } = useChat({
    id: chatIdWithModel,
    messages: agent ? (storedMessages as any) : [],
    transport: transport as any,
    experimental_throttle: 1000,
    sendAutomaticallyWhen: (options) => {
      const lastMessage = options.messages[options.messages.length - 1];

      // 检查 assistant 消息中的 parts（UI 消息格式）
      if (lastMessage?.role === 'assistant') {
        const parts = lastMessage.parts || [];

        // 获取最后一步的工具调用（使用 type.startsWith('tool-') 匹配所有工具类型）
        const lastStepStartIndex = parts.reduce((lastIndex: number, part: any, index: number) => {
          return part.type === 'step-start' ? index : lastIndex;
        }, -1);
        const lastStepToolInvocations = parts.slice(lastStepStartIndex + 1).filter(
          (part: any) =>
            part.type?.startsWith('tool-') &&
            part.type !== 'tool-result' &&
            !part.providerExecuted
        );

        // 检查是否有审批响应（approval-responded 状态）
        const hasApprovalResponse = lastStepToolInvocations.some(
          (part: any) => part.state === 'approval-responded'
        );

        // 调试日志
        console.log('[sendAutomaticallyWhen]', {
          lastStepToolInvocations: lastStepToolInvocations.length,
          hasApprovalResponse,
          states: lastStepToolInvocations.map((p: any) => p.state)
        });

        if (hasApprovalResponse) {
          console.log('[sendAutomaticallyWhen] 有审批响应，触发执行');
          return true;
        }
      }

      // 兜底：检查所有审批是否完成（原有逻辑）
      return lastAssistantMessageIsCompleteWithApprovalResponses(options) ||
        lastAssistantMessageIsCompleteWithToolCalls(options);
    },
    onError: (err) => {
      setLastError(err);
      setShowError(true);
    },
    onFinish: ({ messages: finishedMessages }) => {
      // 紧急更新：保存消息（需要立即完成）
      if (isEphemeral) {
        setEphemeralMessages(finishedMessages as UIMessage[]);
      } else if (chatId && activeConversation) {
        setMessages(chatId, finishedMessages as UIMessage[]);
      }

      // ✅ Token 统计更新
      const lastUsage = lastTokenUsageRef.current;
      if (lastUsage) {
        if (isEphemeral) {
          // 临时会话：更新本地状态
          setEphemeralTotalTokens(prev => prev + lastUsage.totalTokens);
          setEphemeralLastTokenUsage({
            ...lastUsage,
            timestamp: Date.now()
          });
        } else if (chatId && activeConversation) {
          // 普通会话：使用 startTransition 更新 Store（rerender-transitions）
          startTransition(() => {
            const currentTotal = activeConversation.totalTokens || 0;
            updateConversation(chatId, {
              totalTokens: currentTotal + lastUsage.totalTokens,
              lastTokenUsage: {
                ...lastUsage,
                timestamp: Date.now()
              }
            });
          });
        }
      }
    },
  });

  // 精确的状态计算
  const isStreaming = status === 'streaming' || status === 'submitted';

  // 优化：使用 useMemo 缓存消息过滤结果
  const displayMessages = useMemo(
    () => messages.filter((msg) => msg.role === 'user' || msg.role === 'assistant'),
    [messages]
  );

  // ==================== 所有 Hooks 必须在条件返回之前 ====================
  // 处理发送消息（从 ChatInput 组件调用）
  const handleSend = useCallback((text: string) => {
    if (isStreaming) return;
    sendMessage({ text });
  }, [isStreaming, sendMessage]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleRetry = useCallback(() => {
    if (!lastError || !chatId) return;
    regenerate();
    setShowError(false);
  }, [lastError, chatId, regenerate]);

  const handleDismissError = useCallback(() => {
    clearError();
    setShowError(false);
  }, [clearError]);

  // ==================== 早期返回：空状态 ====================
  // 必须在所有 hooks 之后
  // 临时会话允许 activeConversation 为空，但必须有 provider 和 model
  if ((!activeConversation && !isEphemeral) || !currentProvider || !currentModel) {
    return (
      <Flex direction="column" align="center" justify="center" className="chat-interface-empty">
        <Bot size={48} className="empty-state-icon" />
        <Text size="4" weight="bold" mt="4" className="empty-state-title">
          {/* @ts-ignore - i18next 类型系统的限制 */}
          {t('chat.interface.noConversation')}
        </Text>
        <Text size="2" color="gray" mt="2">
          {/* @ts-ignore - i18next 类型系统的限制 */}
          {t('chat.interface.selectOrCreate')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className={`chat-interface ${isEphemeral ? 'ephemeral' : ''}`}>
      {/* 错误横幅 */}
      {showError && lastError ? (
        <ErrorBanner
          error={lastError}
          onRetry={handleRetry}
          onDismiss={handleDismissError}
        />
      ) : null}

      {/* 头部：标题 */}
      <Flex direction="row" gap="2" align="center" className="chat-interface-header">
        <Bot size={16} />
        <Flex direction="column" gap="1">
          <Flex direction="row" align="center" gap="2">
            <Text size="2" weight="bold">
              {isEphemeral
                ? (t as any)('chat.ephemeral.title')
                : activeConversation!.title}
            </Text>
            {isEphemeral && (
              <>
                <Text size="1" color="gray">·</Text>
                <Text size="1" color="amber">
                  {/* @ts-ignore - i18next 类型系统的限制 */}
                  {(t as any)('chat.ephemeral.warning')}
                </Text>
              </>
            )}
          </Flex>
        </Flex>
      </Flex>

      {/* 消息列表 */}
      <div className="chat-interface-messages">
        <VirtualMessageList
          messages={displayMessages}
          t={t}
          sshProfiles={sshProfiles}
          addToolApprovalResponse={addToolApprovalResponse}
          isStreaming={isStreaming}
          status={status}
        />
      </div>

      {/* 统一的输入面板 - 独立组件，输入不影响消息列表渲染 */}
      <ChatInput
        currentProviderId={isEphemeral ? ephemeralProviderIdState! : activeConversation!.providerId}
        providers={providers}
        currentModelId={currentModel.id}
        models={currentProvider.models}
        contextWindow={currentModel?.contextWindow || 128000}
        isStreaming={isStreaming}
        totalTokens={isEphemeral ? ephemeralTotalTokens : (activeConversation?.totalTokens || 0)}
        lastTokenUsage={isEphemeral ? (ephemeralLastTokenUsage || undefined) : activeConversation?.lastTokenUsage}
        enabledTools={currentEnabledTools}
        onToolsChange={(tools) => {
          if (isEphemeral) {
            setEphemeralEnabledTools(tools);
          } else {
            updateConversation(chatId!, { enabledTools: tools });
          }
        }}
        // @ts-ignore - i18next 类型系统的限制
        placeholder={t('chat.interface.placeholder')}
        onProviderChange={(providerId, modelId) => {
          if (isEphemeral) {
            // 临时会话：更新本地 state
            setEphemeralProviderIdState(providerId);
            setEphemeralModelIdState(modelId);
          } else {
            // 普通会话：更新到 store
            updateConversation(chatId!, { providerId, modelId });
          }
        }}
        onModelChange={(modelId) => {
          if (isEphemeral) {
            // 临时会话：更新本地 state
            setEphemeralModelIdState(modelId);
          } else {
            // 普通会话：更新到 store
            updateConversation(chatId!, { modelId });
          }
        }}
        onSend={handleSend}
        onStop={handleStop}
      />
    </Flex>
  );
}
