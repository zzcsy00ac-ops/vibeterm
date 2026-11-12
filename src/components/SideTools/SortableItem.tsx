/**
 * 可拖拽的工具栏项包装组件
 *
 * 使用 @dnd-kit/sortable 提供拖拽功能
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Transform } from '@dnd-kit/utilities';
import type { SideToolItem } from './types';
import { ToolButton } from './ToolButton';
import './SortableItem.css';

export interface SortableItemProps {
  item: SideToolItem;
  index: number;
  isActive?: boolean;
  onSidebarToggle?: () => void;
  needUpdate?: boolean;
}

export function SortableItem({ item, isActive, onSidebarToggle, needUpdate }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: item.draggable === false || item.type === 'divider' || item.type === 'special',
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform as Transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 对于不可拖拽的项，只返回按钮本身
  if (item.draggable === false || item.type === 'divider' || item.type === 'special') {
    return (
      <div ref={setNodeRef} style={style} className="sortable-item">
        <ToolButton
          item={item}
          isActive={isActive}
          onSidebarToggle={onSidebarToggle}
          needUpdate={needUpdate}
        />
      </div>
    );
  }

  // 可拖拽的项：将 drag props 传递给 ToolButton
  return (
    <div ref={setNodeRef} style={style} className="sortable-item">
      <ToolButton
        item={item}
        isActive={isActive}
        onSidebarToggle={onSidebarToggle}
        needUpdate={needUpdate}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}
