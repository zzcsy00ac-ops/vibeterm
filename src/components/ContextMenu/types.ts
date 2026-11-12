/**
 * 通用 ContextMenu 组件类型定义
 *
 * 支持两种使用模式：
 * 1. Radix UI 触发模式：使用 asChild 包装触发元素
 * 2. 手动定位模式：通过 x, y 坐标和 visible 状态控制显示
 */

import type { ReactNode } from 'react';

// ==================== 菜单项类型 ====================

/**
 * 菜单项配置
 */
export interface ContextMenuItem {
  /** 唯一标识（用于 key） */
  key: string;

  /** 菜单项显示文本 */
  label: string;

  /** 可选图标（React 节点或 lucide-react 图标组件） */
  icon?: ReactNode;

  /** 快捷键提示（如 "Ctrl+C"） */
  shortcut?: string;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否危险操作（如删除，显示红色） */
  danger?: boolean;

  /** 在此项之前显示分隔线 */
  separator?: boolean;

  /** 点击回调 */
  onClick: () => void;

  /** 条件隐藏（当为 true 时不渲染此项） */
  hide?: boolean;

  // ===== 兼容 Tree 的 MenuItem 字段 =====
  /** 兼容 Tree: 菜单项唯一标识（等同于 key） */
  id?: string;

  /** 兼容 Tree: 菜单项显示文本（等同于 label） */
  title?: string;

  /** 兼容 Tree: 关联的树节点 */
  node?: any;
}

// ==================== 模式 1: Radix UI 触发模式 ====================

/**
 * Radix UI 触发模式 Props
 *
 * 使用 asChild 包装触发元素，右键点击自动显示菜单
 */
export interface ContextMenuTriggerProps {
  /** 菜单项配置数组 */
  items: ContextMenuItem[];

  /** 触发菜单的子元素 */
  children: ReactNode;

  /** 菜单与触发器的水平偏移 */
  alignOffset?: number;
}

// ==================== 模式 2: 手动定位模式 ====================

/**
 * 手动定位模式 Props
 *
 * 通过 visible、x、y 控制菜单显示和位置
 */
export interface ContextMenuPositionProps {
  /** 是否显示菜单 */
  visible: boolean;

  /** 菜单 X 坐标 */
  x: number;

  /** 菜单 Y 坐标 */
  y: number;

  /** 菜单项配置数组 */
  items: ContextMenuItem[];

  /** 关闭菜单回调 */
  onClose: () => void;

  /** 菜单与触发器的水平偏移 */
  alignOffset?: number;
}

// ==================== 组件 Props（联合类型）====================

/**
 * ContextMenu 组件 Props
 *
 * 根据 props 判断使用哪种模式：
 * - 有 visible 属性：手动定位模式
 * - 有 children 属性：Radix UI 触发模式
 */
export type ContextMenuProps = ContextMenuTriggerProps | ContextMenuPositionProps;

// ==================== 类型守卫 ====================

/**
 * 判断是否为手动定位模式
 */
export function isPositionMode(props: ContextMenuProps): props is ContextMenuPositionProps {
  return 'visible' in props;
}

/**
 * 判断是否为 Radix UI 触发模式
 */
export function isTriggerMode(props: ContextMenuProps): props is ContextMenuTriggerProps {
  return 'children' in props;
}
