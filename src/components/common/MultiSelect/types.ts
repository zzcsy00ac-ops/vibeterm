/**
 * 通用多选组件类型定义
 *
 * 这是一个可复用的多选组件，支持：
 * - 搜索过滤
 * - 分组显示
 * - 全选/清空
 * - 自定义触发按钮样式
 */

import type { ReactNode } from 'react';

/**
 * 单个选项的定义
 */
export interface MultiSelectItem {
  /** 唯一标识值 */
  value: string;
  /** 显示标签（可能是翻译 key，由父组件处理） */
  label: string;
  /** 描述文本（可选） */
  description?: string;
  /** 所属分组 ID（可选） */
  group?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 图标组件（可选） */
  icon?: ReactNode;
}

/**
 * 分组定义
 */
export interface MultiSelectGroup {
  /** 分组唯一 ID */
  id: string;
  /** 分组显示标签 */
  label: string;
  /** 分组描述（可选） */
  description?: string;
}

/**
 * 触发按钮大小选项
 */
export type TriggerSize = '1' | '2' | '3';

/**
 * 组件 Props
 */
export interface MultiSelectProps {
  /** 所有选项 */
  items: MultiSelectItem[];
  /** 分组定义（可选） */
  groups?: MultiSelectGroup[];
  /** 当前选中的值 */
  value: string[];
  /** 值变化回调 */
  onChange: (value: string[]) => void;
  /** 触发按钮占位文本 */
  placeholder?: string;
  /** 搜索框占位文本 */
  searchPlaceholder?: string;
  /** 全选按钮文本 */
  selectAllLabel?: string;
  /** 标题文本 */
  title?: string;
  /** 无结果文本 */
  noResultsText?: string;
  /** 选中计数文本格式 */
  selectedCountText?: (current: number, total: number) => string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 触发按钮大小 */
  triggerSize?: TriggerSize;
}
