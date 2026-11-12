/**
 * MessageItem - 单条消息组件
 *
 * 显示聊天消息的内容，包括用户/AI 头像、文本内容、工具执行卡片等。
 * 使用 memo 优化性能，只有消息内容变化时才重新渲染。
 */

import { Flex, Text } from '@radix-ui/themes';
import {
  User,
  Copy,
} from 'lucide-react';
import { memo, useMemo, useCallback } from 'react';
import { ToolApprovalCard } from '../ToolApprovalCard/ToolApprovalCard';
import { TextPart } from '../TextPart/TextPart';
import { normalizeSingleMessage } from '../../utils/textNormalizer';
import { toast } from 'sonner';
import ContextMenu from '../ContextMenu/ContextMenu';
import type { ApprovalRememberType } from '../../types/permissions';

interface MessageItemProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    parts: Array<{ type: string; text?: string; [key: string]: any }>;
  };
  t: any; // i18next TFunction
  sshProfiles: Array<{ id: string; name: string; host: string }>;
  /** 批量批准处理函数（包含权限存储和批量处理逻辑） */
  onApprove: (
    id: string | undefined,
    options?: { rememberType: ApprovalRememberType },
    input?: { serverId?: string; command?: string }
  ) => void;
  /** 拒绝命令的函数 */
  addToolApprovalResponse: any; // useChat 返回的函数
}

export const MessageItem = memo(function MessageItem({
  message,
  t,
  sshProfiles,
  onApprove,
  addToolApprovalResponse
}: MessageItemProps) {
  // 规范化消息文本，修复 AI 流式响应中的换行符丢失问题
  const normalizedMessage = useMemo(() => normalizeSingleMessage(message), [message]);

  const handleDeny = useCallback((id: string | undefined) => {
    addToolApprovalResponse({ id, approved: false });
  }, [addToolApprovalResponse]);

  const handleCopy = useCallback(async () => {
    const text = normalizedMessage.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');

    if (!text) {
      toast.error('没有可复制的内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败，请手动选择复制');
    }
  }, [normalizedMessage]);

  // 复制选中的文本
  const handleCopySelection = useCallback(async () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';

    if (!selectedText) {
      toast.error('请先选择要复制的文本');
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      toast.success('已复制到剪贴板');
      selection?.removeAllRanges();
    } catch (error) {
      toast.error('复制失败，请手动选择复制');
    }
  }, []);

  // 右键菜单项
  const contextMenuItems = useMemo(() => [
    {
      key: 'copy-selection',
      label: '复制',
      icon: <Copy size={14} />,
      shortcut: 'Ctrl+C',
      onClick: handleCopySelection,
    },
    {
      key: 'copy-message',
      label: '复制整条消息',
      icon: <Copy size={14} />,
      onClick: handleCopy,
    },
  ], [handleCopySelection, handleCopy]);

  return (
    <Flex
      direction="row"
      gap="3"
      className={`message-item ${message.role}`}
    >
      <Flex
        direction="row"
        gap="2"
        align="center"
        justify="start"
      >
        {message.role === 'user' ? (
          <User size={16} />
        ) : (
          <img src="/images/assistant-avatar.jpg" alt="Assistant" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}  className='animate-pulse'/>
        )}
         {message.role === 'assistant' && (
          <Text size="1" color="gray" className='font-bold font-mono text-shadow-2xs animate-pulse'>
            {/* @ts-ignore - i18next 类型系统的限制 */}
            {t('chat.interface.assistant')}
          </Text>
        )}
      </Flex>
      <ContextMenu items={contextMenuItems}>
        <Flex direction="column" gap="2" className="message-item-content">
          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            className="copy-button"
            aria-label="复制消息"
            title="复制消息"
          >
            <Copy size={14} />
          </button>


          {/* 遍历消息 parts */}
          {normalizedMessage.parts.map((part: any, index: number) => {
            switch (part.type) {
              // 文本内容
              case 'text':
                return (
                  <div key={index} className="message-text selectable-text">
                    <TextPart text={part.text} />
                  </div>
                );

              // 工具调用 - executeCommand
              case 'tool-executeCommand':
                const server = sshProfiles.find((p) => p.id === part.input?.serverId);
                return (
                  <ToolApprovalCard
                    key={part.toolCallId || index}
                    invocation={part}
                    serverName={server?.name || '未知服务器'}
                    serverHost={server?.host || '未知地址'}
                    onApprove={(options) => onApprove(
                      part.approval?.id,
                      options,
                      { serverId: part.input?.serverId, command: part.input?.command }
                    )}
                    onDeny={() => handleDeny(part.approval?.id)}
                  />
                );

              // 工具结果 - executeCommand
              case 'tool-result-executeCommand':
                return (
                  <div key={index} className="tool-result selectable-text">
                    <TextPart text={part.result || ''} />
                  </div>
                );

              default:
                return null;
            }
          })}
        </Flex>
      </ContextMenu>
    </Flex>
  );
}, (prevProps, nextProps) => {
  // 自定义比较逻辑：只有当 message 变化时才重新渲染
  return prevProps.message === nextProps.message;
});
