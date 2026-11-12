import type { ReactNode } from 'react';

// Re-export the component implementation
export { default } from './Tree';

/**
 * 树节点数据结构
 */
export interface TreeNode {
  /** 唯一标识 */
  id: string;
  /** 显示标题 */
  title: string;
  /** 是否为分支节点（可包含子节点的节点） */
  isBranch?: boolean;
  /** 子节点数据 */
  children?: TreeNode[];
  /** 业务类型（用于右键菜单等业务逻辑判断） */
  type?: string;
  /** 扩展字段 */
  [key: string]: any;
}

/**
 * 右键菜单项配置
 */
export interface MenuItem {
  /** 菜单项唯一标识 */
  id: string;
  /** 菜单项显示文本 */
  title: string;
  /** 可选图标 */
  icon?: ReactNode;
  /** 关联的节点 */
  node?: TreeNode | null;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否分隔线 */
  divider?: boolean;
  /** 是否危险操作（如删除） */
  danger?: boolean;
}

/**
 * 图标获取回调
 */
export type NodeIconGetter = (
  node: TreeNode,
  isExpanded: boolean,
  isBranch: boolean
) => ReactNode;

/**
 * 右键菜单回调
 */
export type ContextMenuCallback = (
  node: TreeNode | null,
  position: { x: number; y: number }
) => MenuItem[];

/**
 * 菜单项点击回调
 */
export type MenuItemCallback = (
  itemId: string,
  node: TreeNode | null
) => void;

/**
 * 节点点击回调
 */
export type NodeClickCallback = (node: TreeNode) => void;

/**
 * 节点展开/折叠回调
 */
export type NodeToggleCallback = (node: TreeNode, isExpanded: boolean) => void;

/**
 * 选中节点变化回调
 */
export type SelectedChangeCallback = (nodeId: string | null) => void;

/**
 * TreeComponent 组件 Props
 */
export interface TreeComponentProps {
  // ========== 必填 ==========
  /** 树形数据 */
  data: TreeNode;
  /** 右键菜单回调 */
  onContextMenu: ContextMenuCallback;
  /** 菜单项点击回调 */
  onItem: MenuItemCallback;

  // ========== 可选 - UI 配置 ==========
  /** 获取节点图标 */
  getNodeIcon?: NodeIconGetter;

  // ========== 可选 - 事件回调 ==========
  /** 默认展开的节点 ID（未受控模式） */
  defaultExpandedIds?: string[];
  /** 受控的展开节点 ID 列表（受控模式） */
  expandedIds?: string[];
  /** 展开状态变化回调（受控模式） */
  onExpandedChange?: (ids: string[]) => void;
  /** 节点点击 */
  onNodeClick?: NodeClickCallback;
  /** 展开/折叠 */
  onNodeToggle?: NodeToggleCallback;
  /** 当前选中的节点 ID */
  selectedId?: string;
  /** 选中节点变化回调 */
  onSelectedChange?: SelectedChangeCallback;

  // ========== 可选 - 样式 ==========
  /** 自定义类名 */
  className?: string;
}

/**
 * 组件内部状态 - 右键菜单
 */
export interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  node: TreeNode | null;
}

/**
 * TreeNode 组件 Props
 */
export interface TreeNodeProps {
  node: TreeNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  getNodeIcon?: NodeIconGetter;
  onToggle: (nodeId: string) => void;
  onNodeClick?: NodeClickCallback;
  onNodeContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onNodeToggle?: NodeToggleCallback;
  onSelectedChange?: SelectedChangeCallback;
  isBranch?: boolean;
}

/**
 * TreeView 组件 Props
 */
export interface TreeViewProps {
  data: TreeNode;
  expandedIds: Set<string>;
  selectedId?: string;
  getNodeIcon?: NodeIconGetter;
  onToggle: (nodeId: string) => void;
  onNodeClick?: NodeClickCallback;
  onNodeContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onNodeToggle?: NodeToggleCallback;
  onSelectedChange?: SelectedChangeCallback;
}
