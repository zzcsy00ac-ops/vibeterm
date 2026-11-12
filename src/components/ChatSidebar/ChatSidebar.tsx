/**
 * ChatSidebar - 聊天会话列表侧边栏
 *
 * 功能：
 * - 显示所有会话列表
 * - 新建会话按钮（在 MainContent 打开标签）
 * - 点击会话时在 MainContent 打开标签
 * - 右键菜单（重命名、删除）
 */

import { Flex, Text, Button, TextField, Dialog } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  MessageCirclePlus,
  MessageCircleDashed,
  MessageSquare,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useProviderStore } from '../../store/providerStore';
import { useAppStore } from '../../store/appStore';
import { getDefaultModel } from '../../lib/modelUtils';
import { useState, useMemo, useRef, memo, useCallback } from 'react';
import type { Conversation } from '../../store/chatStore';
import { Dialog as ConfirmDialog, type DialogRef } from '../Dialog';
import ContextMenu from '../ContextMenu';
import './ChatSidebar.css';

export function ChatSidebar() {
  const { t } = useTranslation();
  const {
    conversations,
    deleteConversation,
    updateConversation,
    createConversation,
  } = useChatStore();

  const { providers } = useProviderStore();
  const { addTab, closeTab, tabs } = useAppStore();

  // 对话框状态
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string>('');
  const [renameTitle, setRenameTitle] = useState('');
  const dialogRef = useRef<DialogRef>(null);

  // 获取会话列表（按更新时间倒序）
  const sortedConversations = useMemo(() => {
    return Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations]);

  // 获取默认模型（优先使用用户设置，回退到第一个可用模型）
  const defaultModelInfo = useMemo(() => {
    return getDefaultModel();
  }, [providers]); // 当 providers 变化时重新计算

  // 根据 defaultModelInfo 获取完整的 provider 和 model 对象
  const defaultProvider = useMemo(() => {
    if (!defaultModelInfo) return null;
    return providers.find(p => p.id === defaultModelInfo.providerId) || null;
  }, [defaultModelInfo, providers]);

  const defaultModel = useMemo(() => {
    if (!defaultProvider || !defaultModelInfo) return null;
    return defaultProvider.models.find(m => m.id === defaultModelInfo.modelId) || null;
  }, [defaultProvider, defaultModelInfo]);

  // 处理新建会话
  const handleCreateConversation = () => {
    if (!defaultProvider || !defaultModel) {
      console.warn('[ChatSidebar] No valid provider or model available');
      return;
    }

    // @ts-ignore - i18next 类型系统的限制
    const newChatTitle = (t('chat.newChat.defaultTitle') as string) || 'New Chat';

    const conversationId = createConversation({
      providerId: defaultProvider.id,
      modelId: defaultModel.id,
      title: newChatTitle,
    });

    // 在 MainContent 打开聊天标签
    addTab({
      title: newChatTitle,
      key: 'chat',
      params: { chatId: conversationId },
    });
  };

  // 处理创建临时会话
  const handleCreateEphemeralChat = () => {
    if (!defaultProvider || !defaultModel) {
      console.warn('[ChatSidebar] No valid provider or model available');
      return;
    }

    // 生成唯一的临时会话 ID，支持同时打开多个临时会话
    const ephemeralId = `ephemeral-${crypto.randomUUID()}`;

    // @ts-ignore - i18next 类型系统的限制
    const ephemeralTitle = t('chat.ephemeral.shortTitle') as string;

    // 在 MainContent 打开临时聊天标签
    addTab({
      title: ephemeralTitle,
      key: 'chat',
      params: {
        chatId: ephemeralId,
        ephemeralProviderId: defaultProvider.id,
        ephemeralModelId: defaultModel.id,
      },
    });
  };

  // 处理会话点击 - 在 MainContent 打开标签
  const handleConversationClick = useCallback((conversation: Conversation) => {
    // 检查是否已有相同 conversationId 的标签
    // 如果有，则切换到该标签；如果没有，则创建新标签
    addTab({
      title: conversation.title,
      key: 'chat',
      params: { chatId: conversation.id },
    });
  }, [addTab]);

  // 处理右键菜单 - 重命名
  const handleRename = useCallback((conversation: Conversation) => {
    setRenameConversationId(conversation.id);
    setRenameTitle(conversation.title);
    setRenameDialogOpen(true);
  }, []);

  // 确认重命名
  const handleRenameConfirm = () => {
    if (renameConversationId && renameTitle.trim()) {
      updateConversation(renameConversationId, { title: renameTitle.trim() });
    }
    setRenameDialogOpen(false);
    setRenameConversationId('');
    setRenameTitle('');
  };

  // 处理删除
  const handleDelete = useCallback((conversation: Conversation) => {
    dialogRef.current?.confirm({
      // @ts-ignore - i18next 类型系统的限制
      title: t('chat.sidebar.deleteDialog.title'),
      // @ts-ignore - i18next 类型系统的限制
      message: t('chat.sidebar.deleteDialog.message', { title: conversation.title }),
      // @ts-ignore - i18next 类型系统的限制
      confirmText: t('common.buttons.delete'),
      // @ts-ignore - i18next 类型系统的限制
      cancelText: t('common.buttons.cancel'),
      type: 'danger',
      onConfirm: () => {
        // 删除会话
        deleteConversation(conversation.id);
        // 关闭所有对应的标签页
        tabs
          .filter((tab) => tab.key === 'chat' && tab.params?.chatId === conversation.id)
          .forEach((tab) => closeTab(tab.id));
      },
    });
  }, [t, deleteConversation, tabs, closeTab]);

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // 今天：显示时间
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // 昨天
      // @ts-ignore - i18next 类型系统的限制
      return t('chat.sidebar.yesterday');
    } else if (diffDays < 7) {
      // 本周：显示星期几
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // 更早：显示日期
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Flex direction="column" className="chat-sidebar">
      {/* 头部：标题 + 新建按钮 */}
      <Flex direction="row" align="center" justify="between" className="chat-sidebar-header">
        <Text size="2" weight="bold">
          {/* @ts-ignore - i18next 类型系统的限制 */}
          {t('chat.sidebar.title')}
        </Text>
        <Flex gap="4">
      
          {/* 新建聊天按钮 */}
          <Button
            size="1"
            variant="ghost"
            onClick={handleCreateConversation}
            disabled={!defaultProvider || !defaultModel}
            // @ts-ignore - i18next 类型系统的限制
            title={t('chat.sidebar.newChat')}
          >
            <MessageCirclePlus size={16} />
          </Button>

           {/* 临时聊天按钮 */}
          <Button
            size="1"
            variant="ghost"
            onClick={handleCreateEphemeralChat}
            disabled={!defaultProvider || !defaultModel}
            // @ts-ignore - i18next 类型系统的限制
            title={t('chat.ephemeral.tooltip')}
            className="ephemeral-chat-btn"
          >
            <MessageCircleDashed size={16} />
          </Button>

        </Flex>
      </Flex>

      {/* 会话列表 */}
      <Flex direction="column" gap="1" className="chat-sidebar-list">
        {sortedConversations.length === 0 ? (
          <Flex align="center" justify="center" className="chat-sidebar-empty">
            <Text size="1" color="gray">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('chat.sidebar.empty')}
            </Text>
          </Flex>
        ) : (
          sortedConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onClick={handleConversationClick}
              onRename={handleRename}
              onDelete={handleDelete}
              formatTime={formatTime}
            />
          ))
        )}
      </Flex>

      {/* 重命名对话框 */}
      <Dialog.Root open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <Dialog.Content style={{ maxWidth: 400 }}>
          <Dialog.Title>
            {/* @ts-ignore - i18next 类型系统的限制 */}
            {t('chat.sidebar.renameDialog.title')}
          </Dialog.Title>
          <Dialog.Description>
            {/* @ts-ignore - i18next 类型系统的限制 */}
            {t('chat.sidebar.renameDialog.description')}
          </Dialog.Description>

          <Flex direction="column" gap="3" mt="4">
            <TextField.Root
              value={renameTitle}
              onChange={(e) => setRenameTitle((e.target as HTMLInputElement).value)}
              // @ts-ignore - i18next 类型系统的限制
              placeholder={t('chat.sidebar.renameDialog.placeholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRenameConfirm();
                }
              }}
            />
            <Flex gap="3" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  {/* @ts-ignore - i18next 类型系统的限制 */}
                  {t('common.cancel')}
                </Button>
              </Dialog.Close>
              <Button onClick={handleRenameConfirm}>
                {/* @ts-ignore - i18next 类型系统的限制 */}
                {t('common.confirm')}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 通用确认对话框 */}
      <ConfirmDialog ref={dialogRef} />
    </Flex>
  );
}

// ==================== ConversationItem 组件 ====================

interface ConversationItemProps {
  conversation: Conversation;
  onClick: (conversation: Conversation) => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
  formatTime: (timestamp: number) => string;
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  onClick,
  onRename,
  onDelete,
  formatTime,
}: ConversationItemProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  // 使用 useCallback 稳定菜单项处理器
  const handleRenameClick = useCallback(() => {
    onRename(conversation);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [conversation, onRename]);

  const handleDeleteClick = useCallback(() => {
    onDelete(conversation);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [conversation, onDelete]);

  // 稳定的点击处理器（避免每次渲染创建新函数）
  const handleClick = useCallback(() => {
    onClick(conversation);
  }, [conversation, onClick]);

  const handleCloseMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // 构建菜单项（使用稳定的回调引用）
  const menuItems = useMemo(() => [
    {
      key: 'rename',
      // @ts-ignore - i18next 类型系统的限制
      label: t('chat.contextMenu.rename') as string,
      icon: <Pencil size={14} />,
      onClick: handleRenameClick,
    },
    {
      key: 'delete',
      // @ts-ignore - i18next 类型系统的限制
      label: t('chat.contextMenu.delete') as string,
      icon: <Trash2 size={14} />,
      danger: true,
      separator: true,
      onClick: handleDeleteClick,
    },
  ], [t, handleRenameClick, handleDeleteClick]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <>
      <Flex
        direction="column"
        className="conversation-item"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <Flex direction="row" align="center" justify="between" className="conversation-item-header">
          <Flex direction="row" align="center" gap="2" className="conversation-item-title">
            <MessageSquare size={14} />
            <Text size="2" truncate>
              {conversation.title}
            </Text>
          </Flex>
          <Flex direction="row" align="center" gap="2" className="conversation-item-actions">
            <Text size="1" color="gray">
              <Clock size={14} />
            </Text>
            <Text size="1" color="gray">
              {formatTime(conversation.updatedAt)}
            </Text>
          </Flex>
        </Flex>
        {/* Token 统计 */}
        {conversation.totalTokens && (
          <Text size="1" color="gray" mt="1">
            {conversation.totalTokens.toLocaleString()} tokens
          </Text>
        )}
      </Flex>

      {/* 右键菜单 */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={menuItems}
        onClose={handleCloseMenu}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：仅当关键属性变化时才重渲染
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.title === nextProps.conversation.title &&
    prevProps.conversation.updatedAt === nextProps.conversation.updatedAt &&
    prevProps.conversation.totalTokens === nextProps.conversation.totalTokens
  );
});
