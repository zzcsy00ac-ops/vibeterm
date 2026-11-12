import { memo } from 'react';
import type { TreeViewProps } from './Tree.types';
import { TreeNode } from './TreeNode';

function TreeView({
  data,
  expandedIds,
  selectedId,
  getNodeIcon,
  onToggle,
  onNodeClick,
  onNodeContextMenu,
  onNodeToggle,
  onSelectedChange,
}: TreeViewProps) {
  // 判断根节点是否展开
  const isExpanded = expandedIds.has(data.id);

  return (
    <div className="tree-view">
      <TreeNode
        node={data}
        level={0}
        isExpanded={isExpanded}
        isSelected={selectedId === data.id}
        getNodeIcon={getNodeIcon}
        onToggle={onToggle}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeToggle={onNodeToggle}
        onSelectedChange={onSelectedChange}
        expandedIds={expandedIds}
        selectedId={selectedId}
      />
    </div>
  );
}

export const TreeViewMemo = memo(TreeView);
