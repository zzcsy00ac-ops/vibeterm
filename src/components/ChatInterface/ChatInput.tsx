/**
 * ChatInput - 聊天输入组件（独立）
 *
 * 功能：
 * - 文本输入和发送
 * - 模型选择器
 * - Token 统计显示
 * - 发送/停止按钮
 *
 * 性能优化：
 * - 独立组件，输入状态变化不影响消息列表
 * - 使用 memo 避免不必要的重新渲染
 */

import { Flex, Text, Button, TextArea } from '@radix-ui/themes';
import * as SelectPrimitive from '@radix-ui/react-select';
import { memo, useCallback, useState, useEffect } from 'react';
import { Send, Bot, Square } from 'lucide-react';
import { ToolSelector } from './ToolSelector';
import { SkillSelector } from './SkillSelector';
import { TokenBadge } from './TokenBadge';
import type { TokenUsageDetail } from '../../store/chatStore';
import type { ToolName } from '../../services/tools';
import './ChatInput.css';

interface ChatInputProps {
  /** 当前提供商 ID */
  currentProviderId: string;
  /** 所有提供商列表 */
  providers: Array<{ id: string; name: string; apiType: string; models: Array<{ id: string; name: string; displayName?: string; enabled?: boolean; contextWindow?: number }> }>;
  /** 当前模型 ID */
  currentModelId: string;
  /** 当前提供商的模型列表 */
  models: Array<{ id: string; name: string; displayName?: string; enabled?: boolean; contextWindow?: number }>;
  /** 当前模型的上下文窗口限制 */
  contextWindow: number;
  /** 是否正在流式响应 */
  isStreaming: boolean;
  /** 累计总 token 数 */
  totalTokens?: number;
  /** 最后一次请求的 token 明细 */
  lastTokenUsage?: TokenUsageDetail;
  /** 占位符文本 */
  placeholder: string;
  /** 启用的工具列表 */
  enabledTools: ToolName[];
  /** 工具变化回调 */
  onToolsChange: (tools: ToolName[]) => void;
  /** 提供商变化回调 */
  onProviderChange: (providerId: string, modelId: string) => void;
  /** 模型变化回调 */
  onModelChange: (modelId: string) => void;
  /** 发送消息回调 */
  onSend: (text: string) => void;
  /** 停止响应回调 */
  onStop: () => void;
}

export const ChatInput = memo(function ChatInput({
  currentProviderId,
  providers,
  currentModelId,
  models,
  contextWindow,
  isStreaming,
  totalTokens,
  lastTokenUsage,
  placeholder,
  enabledTools,
  onToolsChange,
  onProviderChange,
  onModelChange,
  onSend,
  onStop,
}: ChatInputProps) {
  // 输入状态在组件内部管理，不影响父组件
  const [input, setInput] = useState('');
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 获取 .app-container 作为 Portal 挂载点
  useEffect(() => {
    const container = document.querySelector('.app-container') as HTMLElement;
    setPortalContainer(container);
  }, []);

  // 处理发送
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    onSend(trimmed);
    setInput('');
  }, [input, isStreaming, onSend]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 处理输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // 处理提供商变化
  const handleProviderChange = useCallback((providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    // 选择该 provider 的第一个启用模型，或第一个模型
    const model = provider.models.find(m => m.enabled) || provider.models[0];
    if (model) {
      onProviderChange(providerId, model.id);
    }
  }, [providers, onProviderChange]);

  // 处理模型变化
  const handleModelChange = useCallback((modelId: string) => {
    onModelChange(modelId);
  }, [onModelChange]);

  return (
    <Flex direction="column" className="chat-input-panel">
      {/* 工具栏：Skills + 工具选择 + 提供商 + 模型选择 */}
      <Flex direction="row" align="center" className="input-panel-toolbar" gap="2">
        {/* Skills 选择器 */}
        <SkillSelector />

        {/* 工具选择器 */}
        <ToolSelector
          selectedTools={enabledTools}
          onToolsChange={onToolsChange}
        />

        {/* 提供商选择 */}
        <SelectPrimitive.Root
          value={currentProviderId}
          onValueChange={handleProviderChange}
        >
          <SelectPrimitive.Trigger className="model-select-inline" aria-label="Provider">
            <Bot size={14} style={{ flexShrink: 0 }} />
            <SelectPrimitive.Value placeholder="选择提供商" />
            <SelectPrimitive.Icon className="select-icon">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal container={portalContainer || undefined}>
            <SelectPrimitive.Content className="model-select-content">
              <SelectPrimitive.Viewport className="model-select-viewport">
                {providers.map((provider) => (
                  <SelectPrimitive.Item key={provider.id} value={provider.id} className="model-select-item">
                    <SelectPrimitive.ItemText>
                      {provider.name}
                      <Text size="1" color="gray" style={{ marginLeft: '4px' }}>
                        ({provider.apiType})
                      </Text>
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {/* 模型选择 */}
        <SelectPrimitive.Root
          value={currentModelId}
          onValueChange={handleModelChange}
        >
          <SelectPrimitive.Trigger className="model-select-inline" aria-label="Model">
            <Bot size={14} style={{ flexShrink: 0 }} />
            <SelectPrimitive.Value placeholder="选择模型" />
            <SelectPrimitive.Icon className="select-icon">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal container={portalContainer || undefined}>
            <SelectPrimitive.Content className="model-select-content">
              <SelectPrimitive.Viewport className="model-select-viewport">
                {models.map((model) => (
                  <SelectPrimitive.Item key={model.id} value={model.id} className="model-select-item">
                    <SelectPrimitive.ItemText>
                      {model.displayName || model.name}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {/* Token 统计 - 使用 TokenBadge 组件 */}
        <TokenBadge
          currentContextTokens={lastTokenUsage?.totalTokens || 0}
          contextWindow={contextWindow}
          totalTokens={totalTokens || 0}
          lastTokenUsage={lastTokenUsage}
        />
      </Flex>

      {/* 输入框区域 */}
      <Flex direction="row" align="end" gap="2" className="input-panel-textarea">
        <TextArea
          className="chat-textarea"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="2"
            color="red"
            onClick={onStop}
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button
            size="2"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send size={16} />
          </Button>
        )}
      </Flex>
    </Flex>
  );
});
