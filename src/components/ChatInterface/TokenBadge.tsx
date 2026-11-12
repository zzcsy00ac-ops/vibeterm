/**
 * TokenBadge - Token 使用统计显示组件
 *
 * 设计理念：被动信息指示器
 * - 明确的非交互式设计（无背景、无边框、无光标变化）
 * - 使用 Info 图标表示"统计信息"
 * - 悬停时显示详细信息 tooltip
 *
 * 性能优化：
 * - 使用 memo 避免不必要的重渲染
 * - 提取 Tooltip 内容为独立组件
 *
 * 可访问性：
 * - ARIA 标签描述统计信息
 * - role="status" 语义标记
 */

import { memo } from 'react';
import { Tooltip, Text, Flex } from '@radix-ui/themes';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTokenCount } from '../../utils/tokenFormatter';
import type { TokenUsageDetail } from '../../store/chatStore';
import './ChatInput.css';

/**
 * TokenBadge 组件属性
 */
export interface TokenBadgeProps {
  /** 本次请求的 token 总数（上下文使用） */
  currentContextTokens: number;
  /** 模型上下文窗口限制 */
  contextWindow: number;
  /** 会话累计总 token 数 */
  totalTokens?: number;
  /** 最后一次请求的 token 明细 */
  lastTokenUsage?: TokenUsageDetail;
}

// ✅ 提取 Tooltip 内容为独立组件（rendering-hoist-jsx）
// 使用 div 而不是 Flex，避免 HTML 嵌套错误（<p> 不能包含 <div>）
const TokenTooltipContent = memo(function TokenTooltipContent({
  lastTokenUsage,
  totalTokens,
  currentContextTokens,
  contextWindow,
  t
}: {
  lastTokenUsage: TokenUsageDetail;
  totalTokens: number;
  currentContextTokens: number;
  contextWindow: number;
  t: any; // @ts-ignore - i18next 类型系统的限制
}) {
  return (
    <div className="token-tooltip-content">
      {/* 标题 */}
      <Text as="div" size="2" weight="bold" className="token-tooltip-title">
        {t('chat.tokens.tooltip.title')}
      </Text>

      {/* 数据行 */}
      <div className="token-tooltip-rows">
        <div className="token-tooltip-row">
          <Text size="2" className="token-tooltip-label">{t('chat.tokens.tooltip.input')}</Text>
          <Text size="2" weight="medium" className="token-tooltip-value">
            {lastTokenUsage.inputTokens.toLocaleString()}
          </Text>
        </div>

        <div className="token-tooltip-row">
          <Text size="2" className="token-tooltip-label">{t('chat.tokens.tooltip.output')}</Text>
          <Text size="2" weight="medium" className="token-tooltip-value">
            {lastTokenUsage.outputTokens.toLocaleString()}
          </Text>
        </div>

        {/* 分隔线 */}
        <div className="token-tooltip-divider" />

        <div className="token-tooltip-row">
          <Text size="1" className="token-tooltip-label">{t('chat.tokens.tooltip.lastRequest')}</Text>
          <Text size="1" className="token-tooltip-value">
            {formatTokenCount(currentContextTokens)}
          </Text>
        </div>

        <div className="token-tooltip-row">
          <Text size="1" className="token-tooltip-label">{t('chat.tokens.tooltip.windowLimit')}</Text>
          <Text size="1" className="token-tooltip-value">
            {formatTokenCount(contextWindow)}
          </Text>
        </div>

        <div className="token-tooltip-row">
          <Text size="1" className="token-tooltip-label">{t('chat.tokens.tooltip.cumulative')}</Text>
          <Text size="1" weight="bold" className="token-tooltip-accent">
            {totalTokens.toLocaleString()} tokens
          </Text>
        </div>
      </div>
    </div>
  );
});

// ✅ 使用 memo 避免不必要的重渲染（rerender-memo）
export const TokenBadge = memo(function TokenBadge({
  currentContextTokens,
  contextWindow,
  totalTokens,
  lastTokenUsage
}: TokenBadgeProps) {
  const { t } = useTranslation();

  // 空状态提前返回（rendering-conditional-render）
  if (currentContextTokens === undefined || currentContextTokens < 0) {
    return null;
  }

  return (
    <Tooltip
      content={
        lastTokenUsage ? (
          <TokenTooltipContent
            lastTokenUsage={lastTokenUsage}
            totalTokens={totalTokens || 0}
            currentContextTokens={currentContextTokens}
            contextWindow={contextWindow}
            t={t}
          />
        ) : (
          <div className="token-tooltip-simple">
            <Text size="2">{(t as any)('chat.tokens.tooltip.cumulative')}</Text>
            <Text size="2" weight="bold" className="token-tooltip-accent">
              {totalTokens?.toLocaleString() || 0} tokens
            </Text>
          </div>
        )
      }
      delayDuration={300}
    >
      <Flex
        align="center"
        gap="2"
        className="token-badge-passive"
        aria-label={(t as any)('chat.tokens.ariaLabel', {
          current: currentContextTokens,
          max: contextWindow
        })}
        role="status"
      >
        {/* Info 图标 - 表示"统计信息" */}
        <Info
          size={14}
          className="token-badge-icon"
          strokeWidth={2}
        />

        {/* Token 数量显示：当前 / 限制 */}
        <Text
          size="2"
          className="token-badge-text"
        >
          {formatTokenCount(currentContextTokens)} / {formatTokenCount(contextWindow)}
        </Text>
      </Flex>
    </Tooltip>
  );
});
