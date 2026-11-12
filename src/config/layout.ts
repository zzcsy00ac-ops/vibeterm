/**
 * 布局相关配置
 * 管理侧边栏、导航栏等布局元素的尺寸
 */

/**
 * 侧边栏配置
 */
export const SIDEBAR_CONFIG = {
  /** 默认展开尺寸 (百分比) */
  defaultSize: '25%',

  /** 收起时尺寸 */
  collapsedSize: '0%',

  /** 最小尺寸 (百分比) */
  minSize: '18%',

  /** 最大尺寸 (百分比) */
  maxSize: '25%',

  /** 面板初始尺寸 */
  initialSize: '25%',
} as const;

/**
 * Settings 导航栏配置
 */
export const SETTINGS_NAV_CONFIG = {
  /** 导航栏宽度 */
  width: '200px',
} as const;
