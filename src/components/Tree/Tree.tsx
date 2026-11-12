import { useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import type {
  TreeComponentProps,
  ContextMenuState,
  MenuItem,
  TreeNode,
} from './Tree.types';
import { TreeViewMemo } from './TreeView';
import ContextMenu from '../ContextMenu';
import { createTreeRefHandlers, useTreeRef, type TreeRef } from './useTreeRef';
import './Tree.css';

/**
 * 通用树形组件
 *
 * @example
 * ```tsx
 * const treeRef = useTreeRef();
 *
 * // 未受控模式（使用默认展开列表）
 * <TreeComponent
 *   ref={treeRef}
 *   data={treeData}
 *   defaultExpandedIds={['root']}
 *   onContextMenu={(node, pos) => [...]}
 * />
 *
 * // 受控模式（展开状态由父组件管理）
 * <TreeComponent
 *   ref={treeRef}
 *   data={treeData}
 *   expandedIds={expandedIds}
 *   onExpandedChange={setExpandedIds}
 *   onContextMenu={(node, pos) => [...]}
 * />
 *
 * // 全部展开
 * treeRef.current?.expandAll();
 * ```
 */
const TreeComponent = forwardRef<TreeRef, TreeComponentProps>(({
  data,
  onContextMenu,
  onItem,
  getNodeIcon,
  defaultExpandedIds = ['root'],
  expandedIds: controlledExpandedIds,
  onExpandedChange,
  onNodeClick,
  onNodeToggle,
  selectedId,
  onSelectedChange,
  className,
}, ref) => {
  // 检测是否为受控模式
  const isControlled = controlledExpandedIds !== undefined;

  // 未受控模式：使用本地状态
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );

  // 受控模式：使用父组件传入的值
  const expandedIds = useMemo(
    () => new Set(isControlled ? controlledExpandedIds : Array.from(localExpandedIds)),
    [isControlled, controlledExpandedIds, localExpandedIds]
  );

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    items: [],
    node: null,
  });

  // 暴露 ref 方法
  useImperativeHandle(
    ref,
    () => createTreeRefHandlers(data, expandedIds, (newIdsOrFn) => {
      const newIds = typeof newIdsOrFn === 'function'
        ? Array.from(newIdsOrFn(expandedIds))
        : Array.from(newIdsOrFn);

      if (isControlled) {
        onExpandedChange?.(newIds);
      } else {
        setLocalExpandedIds(new Set(newIds));
      }
    }),
    [data, expandedIds, isControlled, onExpandedChange]
  );

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, show: false }));
  }, []);

  // 容器右键（空白区域）
  const handleContainerContextMenu = (e: React.MouseEvent) => {
    // 只在空白区域触发
    if ((e.target as HTMLElement).closest('[data-node-id]')) {
      return;
    }

    e.preventDefault();
    const items = onContextMenu(null, { x: e.clientX, y: e.clientY });

    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      items,
      node: null,
    });
  };

  // 节点右键
  const handleNodeContextMenu = (
    e: React.MouseEvent,
    node: TreeNode
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const items = onContextMenu(node, { x: e.clientX, y: e.clientY });

    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      items,
      node,
    });
  };

  // 菜单项点击
  const handleMenuItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    onItem(item.id, item.node || null);
    closeMenu();
  };

  // 切换展开/折叠
  const handleToggle = (nodeId: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }

    if (isControlled) {
      onExpandedChange?.(Array.from(newSet));
    } else {
      setLocalExpandedIds(newSet);
    }
  };

  return (
    <div
      className={`tree-container ${className || ''}`}
      onContextMenu={handleContainerContextMenu}
      onClick={closeMenu}
    >
      {/* 树形渲染 */}
      <TreeViewMemo
        data={data}
        expandedIds={expandedIds}
        selectedId={selectedId}
        getNodeIcon={getNodeIcon}
        onToggle={handleToggle}
        onNodeClick={onNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeToggle={onNodeToggle}
        onSelectedChange={onSelectedChange}
      />

      {/* 右键菜单 */}
      <ContextMenu
        visible={contextMenu.show}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items.map((item) => ({
          key: item.id,
          label: item.title,
          icon: item.icon,
          disabled: item.disabled,
          danger: item.danger,
          separator: item.divider,
          onClick: () => handleMenuItemClick(item),
        }))}
        onClose={closeMenu}
      />
    </div>
  );
});

TreeComponent.displayName = 'TreeComponent';

export default TreeComponent;
export type { TreeComponentProps as TreeProps };
export type { TreeRef };
export { useTreeRef };
