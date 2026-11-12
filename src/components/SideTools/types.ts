/**
 * 侧边栏工具栏类型定义
 */

/**
 * 工具栏项类型
 */
export type SideToolItemType = 'button' | 'divider' | 'dropdown' | 'special';

/**
 * 侧边栏工具栏项接口
 */
export interface SideToolItem {
  /** 唯一标识符 */
  id: string;
  /** 图标组件 - 运行时通过 ROUTE_ICON_MAP 或 SPECIAL_ICON_MAP 动态获取 */
  icon?: any;
  /** i18n key (如 'app.chats') 或直接文本 */
  title: string;
  /** 路由路径 (如 '/chats') */
  route?: string;
  /** 类型 */
  type: SideToolItemType;
  /** 是否显示 */
  visible?: boolean;
  /** 是否可拖拽排序 (默认 true) */
  draggable?: boolean;
}

/**
 * 路由到图标组件的映射
 *
 * 定义每个路由功能使用的图标组件，直接映射到 Lucide 图标
 */
import {
  PanelLeftDashed,
  Ellipsis,
  CircleArrowUp,
  SquareTerminal,
  type LucideIcon as LucideIconType,
  MessageSquare,
  Brain,
} from 'lucide-react';

export const ROUTE_ICON_MAP: Record<string, LucideIconType> = {
  '/chats': MessageSquare,
  '/ssh': SquareTerminal,
  '/providers': Brain,
};

/**
 * 特殊功能 ID 到图标组件的映射
 *
 * 用于没有路由的特殊项（如 sidebar-toggle、mores、update）
 */
export const SPECIAL_ICON_MAP: Record<string, LucideIconType> = {
  'sidebar-toggle': PanelLeftDashed,
  'mores': Ellipsis,
  'update': CircleArrowUp,
};

/**
 * 默认工具栏配置
 */
export const DEFAULT_SIDE_TOOLS_ITEMS: SideToolItem[] = [
  {
    id: 'sidebar-toggle',
    title: 'app.sidebar',
    type: 'button',
    visible: true,
    draggable: false, // 侧边栏切换按钮不可拖动
  },
  {
    id: 'chats',
    title: 'app.chats',
    route: '/chats',
    type: 'button',
    visible: true,
    draggable: true,
  },
  {
    id: 'ssh',
    title: 'app.sshManager',
    route: '/ssh',
    type: 'button',
    visible: true,
    draggable: true,
  },
  {
    id: 'providers',
    title: 'app.providerManager',
    route: '/providers',
    type: 'button',
    visible: true,
    draggable: true,
  },
  {
    id: 'divider-1',
    title: '',
    type: 'divider',
    visible: true,
    draggable: false,
  },
  {
    id: 'mores',
    title: 'app.mores',
    type: 'dropdown',
    visible: true,
    draggable: false, // 更多按钮不可拖动
  },
  {
    id: 'update',
    title: 'app.update',
    type: 'special',
    visible: false,
    draggable: false,
  },
];
