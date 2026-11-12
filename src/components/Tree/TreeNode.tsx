import { ChevronRight, ChevronDown, Minus } from 'lucide-react';
import type { TreeNodeProps } from './Tree.types';

export function TreeNode({
  node,
  level,
  isExpanded,
  isSelected,
  getNodeIcon,
  onToggle,
  onNodeClick,
  onNodeContextMenu,
  onNodeToggle,
  onSelectedChange,
  expandedIds,
  selectedId,
}: TreeNodeProps & { expandedIds: Set<string>; selectedId?: string }) {
  // 判断是否为分支节点
  // 优先使用 isBranch 字段，否则通过 children 判断
  const isBranch = node.isBranch !== undefined
    ? node.isBranch
    : Boolean(node.children && node.children.length > 0);

  // 通过回调获取图标，传入 isBranch 参数
  const icon = getNodeIcon
    ? getNodeIcon(node, isExpanded as boolean, isBranch)
    : null;

  // 节点内容点击处理
  const handleNodeClick = () => {
    // 分支节点：切换展开/折叠
    if (isBranch) {
      onToggle(node.id);
      onNodeToggle?.(node, !isExpanded);
    }
    // 叶子节点：设置为选中
    if (!isBranch) {
      onSelectedChange?.(node.id);
    }
    // 所有节点：调用点击回调
    onNodeClick?.(node);
  };

  return (
    <div>
      {/* 节点内容 */}
      <div
        data-node-id={node.id}
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onContextMenu={(e) => onNodeContextMenu(e, node)}
        onClick={handleNodeClick}
      >
        {/* 展开/折叠图标 - 分支节点显示箭头，叶子节点显示占位 */}
        <span
          className="tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
            onNodeToggle?.(node, !isExpanded);
          }}
        >
          {isBranch ? (
            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <Minus size={16} />
          )}
        </span>

        {/* 节点图标 - 通过回调获取 */}
        {icon ? <span className="tree-icon">{icon}</span> : null}

        {/* 节点标题 */}
        <span className="tree-title">{node.title}</span>
      </div>

      {/* 子节点 - 仅展开且有子节点时显示 */}
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeMemo
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={expandedIds.has(child.id)}
              isSelected={selectedId === child.id}
              getNodeIcon={getNodeIcon}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              onNodeContextMenu={onNodeContextMenu}
              onNodeToggle={onNodeToggle}
              onSelectedChange={onSelectedChange}
              expandedIds={expandedIds}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 优化：使用 React.memo 避免不必要的重渲染
import { memo } from 'react';
const TreeNodeMemo = memo(TreeNode);
