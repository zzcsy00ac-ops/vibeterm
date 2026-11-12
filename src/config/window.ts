/**
 * 窗口相关配置
 * 管理各类窗口的尺寸和行为
 */

/**
 * Settings 窗口配置
 */
export const SETTINGS_WINDOW_CONFIG = {
  /** 窗口宽度 */
  width: 900,

  /** 窗口高度 */
  height: 600,

  /** 是否居中显示 */
  center: true,

  /** 是否可调整大小 */
  resizable: false,

  /** 是否显示窗口装饰 */
  decorations: true,
} as const;

/**
 * Monitor 监控窗口配置
 */
export const MONITOR_WINDOW_CONFIG = {
  /** 窗口宽度 */
  width: 1000,

  /** 窗口高度 */
  height: 700,

  /** 最小宽度 */
  minWidth: 800,

  /** 最小高度 */
  minHeight: 500,

  /** 是否居中显示 */
  center: true,

  /** 是否可调整大小 */
  resizable: true,

  /** 是否显示窗口装饰 */
  decorations: true,
} as const;
