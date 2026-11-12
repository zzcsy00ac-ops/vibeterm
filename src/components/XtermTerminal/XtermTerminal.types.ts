/**
 * XtermTerminal 组件类型定义
 */

import { Terminal } from '@xterm/xterm';

/**
 * 组件 Props 类型
 *
 * 注意：样式配置现在从 AppState 中读取，支持持久化
 */
export interface XtermTerminalProps {
  /** 接收到数据时的回调（用于未来 SSH 连接） */
  onData?: (data: string) => void;
  /** 是否本地回显（SSH 模式应为 false，演示模式应为 true） */
  localEcho?: boolean;
}

/**
 * 组件暴露的方法类型
 */
export interface XtermTerminalRef {
  /** 向终端写入数据 */
  write: (data: string) => void;
  /** 清空终端 */
  clear: () => void;
  /** 获取终端实例 */
  getTerminal: () => Terminal | null;
  /** 调整终端尺寸 */
  resize: (cols: number, rows: number) => void;
  /** 聚焦终端 */
  focus: () => void;
  /** 重新调整终端尺寸以适应容器 */
  fit: () => void;
}
