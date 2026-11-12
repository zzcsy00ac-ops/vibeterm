/**
 * Lucide 图标映射表
 *
 * 将字符串名称映射到实际的 Lucide React 图标组件
 */

import {
  PanelLeftDashed,
  MessageSquarePlus,
  Settings,
  Terminal,
  CircleArrowUp,
  Cpu,
  type LucideIcon as LucideIconType,
} from 'lucide-react';

export const LucideIcon: Record<string, LucideIconType> = {
  PanelLeftDashed,
  MessageSquarePlus,
  Settings,
  Terminal,
  CircleArrowUp,
  Cpu,
};

export type LucideIcon = LucideIconType;
