import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Tabs from '@radix-ui/react-tabs';
import type { Tab } from '../../store/appStore';
import { useChatStore } from '../../store/chatStore';

interface DraggableTabProps {
  tab: Tab;
  onClose: () => void;
}

/**
 * 可拖拽的标签页组件
 *
 * 结合 @dnd-kit 和 Radix UI Tabs 实现拖拽排序
 * 使用 asChild 属性避免 button 嵌套错误
 *
 * Tab 标题动态读取逻辑：
 * - 对于 chat 类型的 Tab，从 chatStore 动态读取 conversation.title
 * - 这样当用户在侧边栏重命名会话时，Tab 标题会自动更新
 * - 其他类型 Tab 使用静态 tab.title
 */
export function DraggableTab({ tab, onClose }: DraggableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 订阅 chatStore 的 conversations 以确保标题变化时重新渲染
  const conversations = useChatStore((state) => state.conversations);

  // 对于 chat 类型的 Tab，从 chatStore 动态读取标题
  // 其他类型 Tab 使用静态 tab.title
  const displayTitle =
    tab.key === 'chat' && tab.params?.chatId
      ? conversations[tab.params.chatId]?.title || tab.title
      : tab.title;

  return (
    <Tabs.Trigger value={tab.id} asChild>
      <button
        ref={setNodeRef}
        className="tab-trigger"
        style={style}
        type="button"
        {...attributes}
      >
        <span className="tab-title" {...listeners}>
          {displayTitle}
        </span>
        <span
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => {
            // 阻止 mousedown 事件触发拖拽
            e.stopPropagation();
          }}
          aria-label="Close tab"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }
          }}
        >
          ×
        </span>
      </button>
    </Tabs.Trigger>
  );
}
