/**
 * 侧边栏工具栏主组件
 *
 * 数据驱动 + 可拖拽排序的工具栏
 * 顶部和底部按钮固定，只有中间部分可拖拽
 */

import { Flex } from "@radix-ui/themes";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAppStore, useSideToolsItems } from "../../store/appStore";
import { SortableItem } from "./SortableItem";
import { ToolButton } from "./ToolButton";
import "./SideTools.css";

// 固定在顶部的按钮 ID
const FIXED_TOP_ITEMS = ['sidebar-toggle'];
// 固定在底部的按钮 ID
const FIXED_BOTTOM_ITEMS = ['divider-1', 'mores', 'update'];

export default function SideTools() {
  const {
    toggleSidebar: onToggle,
    needUpdate,
    moveSideToolItem,
  } = useAppStore();

  // 使用带图标的工具栏项
  const sideToolsItems = useSideToolsItems();

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动 8px 后才开始拖拽，避免干扰点击
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束事件
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 只处理可拖拽区域的项
      const draggableItems = getDraggableItems();
      const oldIndex = draggableItems.findIndex((item) => item.id === active.id);
      const newIndex = draggableItems.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 在原始数组中找到实际索引
        const realOldIndex = sideToolsItems.findIndex((item) => item.id === active.id);
        const realNewIndex = sideToolsItems.findIndex((item) => item.id === over.id);
        moveSideToolItem(realOldIndex, realNewIndex);
      }
    }
  };

  // 过滤可见的工具栏项
  const visibleItems = sideToolsItems.filter((item) => item.visible !== false);

  // 获取可拖拽的项（排除固定的顶部和底部）
  const getDraggableItems = () => {
    return visibleItems.filter(
      (item) => !FIXED_TOP_ITEMS.includes(item.id) && !FIXED_BOTTOM_ITEMS.includes(item.id)
    );
  };

  const draggableItems = getDraggableItems();

  return (
    <Flex gap="5" direction="column" className="sideTools">
      {/* 固定在顶部的按钮 */}
      {visibleItems.filter((item) => FIXED_TOP_ITEMS.includes(item.id)).map((item) => (
        <div key={item.id} className="sortable-item">
          <ToolButton
            item={item}
            onSidebarToggle={onToggle}
            needUpdate={needUpdate}
          />
        </div>
      ))}

      {/* 可拖拽的中间部分 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={draggableItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <Flex gap="5" direction="column" style={{ flex: 1, justifyContent: 'flex-start' }}>
            {draggableItems.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                onSidebarToggle={onToggle}
                needUpdate={needUpdate}
              />
            ))}
          </Flex>
        </SortableContext>
      </DndContext>
      {/* 固定在底部的按钮 */}
      {visibleItems.filter((item) => FIXED_BOTTOM_ITEMS.includes(item.id)).map((item) => (
        <div key={item.id} className="sortable-item">
          <ToolButton
            item={item}
            onSidebarToggle={onToggle}
            needUpdate={needUpdate}
          />
        </div>
      ))}
    </Flex>
  );
}
