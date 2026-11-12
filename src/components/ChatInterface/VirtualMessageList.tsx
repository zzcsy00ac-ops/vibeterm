/**
 * VirtualMessageList - 虚拟化消息列表组件
 *
 * 使用 React Virtuoso 实现消息列表虚拟化渲染，只渲染可见区域的消息。
 * 自动处理动态高度，内置 Resize 优化，支持任意数量的消息而不影响性能。
 */

import { useRef, forwardRef, useMemo, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Flex, Text } from '@radix-ui/themes';
import { Activity } from 'lucide-react';
import type { UIMessage } from 'ai';
import { MessageItem } from './MessageItem';
import { usePermissionStore } from '../../store/permissionStore';
import type { ApprovalRememberType } from '../../types/permissions';

interface VirtualMessageListProps {
  messages: UIMessage[];
  t: any;
  sshProfiles: Array<{ id: string; name: string; host: string }>;
  addToolApprovalResponse: any;
  isStreaming: boolean;
  status?: string;
}

/**
 * 从消息列表中提取所有等待审批的工具调用
 */
function extractPendingApprovals(messages: UIMessage[]): Map<string, {
  command: string;
  serverId: string;
}> {
  const pendingMap = new Map<string, { command: string; serverId: string }>();

  for (const message of messages) {
    if (!message.parts) continue;

    for (const part of message.parts) {
      // 查找等待审批的 executeCommand 工具调用
      if (
        part.type === 'tool-executeCommand' &&
        part.state === 'approval-requested' &&
        part.approval?.id
      ) {
        const input = part.input as { command?: string; serverId?: string } | undefined;
        pendingMap.set(part.approval.id, {
          command: input?.command || '',
          serverId: input?.serverId || '',
        });
      }
    }
  }

  return pendingMap;
}

/**
 * VirtualMessageList 组件
 *
 * 功能特性：
 * - 虚拟化渲染：只渲染可见区域的消息
 * - 动态高度：自动测量每条消息的高度
 * - 自动滚动：使用 followOutput 自动跟随新消息
 * - 空状态：显示空消息提示
 */
export const VirtualMessageList = forwardRef<any, VirtualMessageListProps>(
  function VirtualMessageList(
    {
      messages,
      t,
      sshProfiles,
      addToolApprovalResponse,
      isStreaming,
      status,
    },
    _ref
  ) {
    // Virtuoso 实例引用（保留用于未来可能的扩展）
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // 获取权限 Store 方法
    const addSessionCommand = usePermissionStore((state) => state.addSessionCommand);
    const addSessionServer = usePermissionStore((state) => state.addSessionServer);
    const isCommandAllowedInSession = usePermissionStore((state) => state.isCommandAllowedInSession);

    // 提取所有等待审批的命令
    const pendingApprovals = useMemo(
      () => extractPendingApprovals(messages),
      [messages]
    );

    // 批量批准处理函数
    const handleApproveWithBatch = useCallback((
      currentApprovalId: string | undefined,
      options?: { rememberType: ApprovalRememberType },
      input?: { serverId?: string; command?: string }
    ) => {
      if (!currentApprovalId) {
        // 没有审批 ID，直接批准当前命令
        addToolApprovalResponse({ id: currentApprovalId, approved: true });
        return;
      }

      // 1. 存储会话权限
      if (options?.rememberType === 'command' && input?.command) {
        addSessionCommand(input.command);
        console.log('[VirtualMessageList] Session command permission added:', input.command);
      } else if (options?.rememberType === 'server' && input?.serverId) {
        addSessionServer(input.serverId);
        console.log('[VirtualMessageList] Session server permission added:', input.serverId);
      }

      // 2. 批准当前命令
      addToolApprovalResponse({ id: currentApprovalId, approved: true });

      // 3. 如果选择了记住选项，批量批准匹配的其他等待中的命令
      if (options?.rememberType && options.rememberType !== 'none') {
        let batchApprovedCount = 0;

        // 重新获取最新的权限状态（因为刚刚添加了新权限）
        for (const [approvalId, pendingInput] of pendingApprovals) {
          // 跳过当前命令
          if (approvalId === currentApprovalId) continue;

          // 检查是否匹配新添加的权限
          const checkResult = isCommandAllowedInSession(
            pendingInput.command,
            pendingInput.serverId
          );

          if (checkResult.allowed) {
            addToolApprovalResponse({ id: approvalId, approved: true });
            batchApprovedCount++;
            console.log('[VirtualMessageList] Batch approved:', approvalId, checkResult.reason);
          }
        }

        if (batchApprovedCount > 0) {
          console.log(`[VirtualMessageList] Batch approved ${batchApprovedCount} additional commands`);
        }
      }
    }, [addToolApprovalResponse, addSessionCommand, addSessionServer, isCommandAllowedInSession, pendingApprovals]);

    // 空状态渲染
    if (messages.length === 0) {
      return (
        <Flex
          direction="column"
          align="center"
          justify="center"
          className="chat-interface-messages-empty"
        >
          <Activity size={32} className="empty-state-icon" />
          <Text size="2" color="gray" mt="4" className="empty-state-title">
            {/* @ts-ignore - i18next 类型系统的限制 */}
            {t('chat.interface.startConversation')}
          </Text>
        </Flex>
      );
    }

    return (
      <div className="virtual-message-list-container" style={{ height: '100%' }}>
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={messages}
          followOutput="smooth"
          itemContent={(_, message) => (
            <div
              className="virtual-message-item"
              style={{
                padding: '12px',
                // 避免创建新的包含块，确保内部 fixed 定位元素正常工作
              }}
            >
              <MessageItem
                message={message as any}
                t={t}
                sshProfiles={sshProfiles}
                onApprove={handleApproveWithBatch}
                addToolApprovalResponse={addToolApprovalResponse}
              />
            </div>
          )}
          defaultItemHeight={150}
          overscan={200}
          increaseViewportBy={{ top: 200, bottom: 200 }}
          components={{
            Footer: isStreaming && status
              ? () => (
                  <Flex direction="row" align="center" gap="2" px="4" py="2">
                    <div className="spin" style={{ width: 16, height: 16 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    </div>
                    <Text size="1" color="gray">
                      {status === 'submitted'
                        ? '发送中...'
                        : status === 'streaming'
                        ? '生成中...'
                        : '处理中...'}
                    </Text>
                  </Flex>
                )
              : undefined,
          }}
        />
      </div>
    );
  }
);
