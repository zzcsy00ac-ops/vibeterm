/**
 * ErrorBanner - 错误提示横幅组件
 *
 * 功能：
 * - 在上方居中显示错误信息
 * - 自动截断过长的错误信息
 * - 支持展开/收起查看完整错误
 * - 提供重试和关闭按钮
 */

import { Flex, Text, Button } from '@radix-ui/themes';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import './ErrorBanner.css';

interface ErrorBannerProps {
  error: Error;
  onRetry: () => void;
  onDismiss: () => void;
}

// 截断文本工具函数
function truncateText(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = error.message.length > 80;

  return (
    <Flex direction="column" className="error-banner-container">
      <Flex
        direction="row"
        align="center"
        gap="3"
        className="error-banner-content"
      >
        {/* 错误图标 */}
        <AlertTriangle size={16} className="error-banner-icon" aria-hidden="true" />

        {/* 错误信息 */}
        <Flex direction="column" className="error-banner-message">
          <Text size="2" weight="bold" className="error-banner-title">
            发生错误
          </Text>
          <Text size="1" className="error-banner-text">
            {isExpanded || !shouldTruncate
              ? error.message
              : truncateText(error.message, 80)}
          </Text>

          {/* 展开/收起按钮 */}
          {shouldTruncate && (
            <Button
              size="1"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="error-banner-expand"
            >
              {isExpanded ? '收起' : '展开'}
            </Button>
          )}
        </Flex>

        {/* 操作按钮 */}
        <Flex direction="row" gap="2" className="error-banner-actions">
          <Button
            size="1"
            variant="soft"
            color="red"
            onClick={onRetry}
            className="error-banner-retry"
          >
            <RotateCcw size={14} aria-hidden="true" />
            重试
          </Button>
          <Button
            size="1"
            variant="ghost"
            onClick={onDismiss}
            className="error-banner-dismiss"
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}
