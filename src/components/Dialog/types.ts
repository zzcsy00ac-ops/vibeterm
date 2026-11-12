import type { ReactNode } from 'react';

/**
 * Dialog 组件 ref 类型
 */
export interface DialogRef {
  /** 确认对话框 */
  confirm: (options: ConfirmOptions) => void;
  /** 提示对话框 */
  alert: (options: AlertOptions) => void;
  /** 输入对话框 */
  prompt: (options: PromptOptions) => void;
}

/**
 * 对话框类型
 */
export type DialogType = 'default' | 'danger' | 'warning';

/**
 * confirm 配置
 */
export interface ConfirmOptions {
  /** 标题 */
  title: string;
  /** 消息内容 */
  message?: string;
  /** 自定义内容（覆盖 message） */
  content?: ReactNode;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 对话框类型 */
  type?: DialogType;
  /** 确认回调 */
  onConfirm?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * alert 配置
 */
export interface AlertOptions {
  /** 标题 */
  title: string;
  /** 消息内容 */
  message?: string;
  /** 自定义内容 */
  content?: ReactNode;
  /** 按钮文字 */
  buttonText?: string;
  /** 按钮点击回调 */
  onButtonClick?: () => void;
}

/**
 * prompt 配置
 */
export interface PromptOptions {
  /** 标题 */
  title: string;
  /** 消息内容 */
  message?: string;
  /** 自定义内容 */
  content?: ReactNode;
  /** 输入框占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 确认回调（参数为输入值） */
  onConfirm?: (value: string) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 内部对话框状态
 */
export interface DialogState {
  /** 是否打开 */
  open: boolean;
  /** 对话框类型 */
  mode: 'confirm' | 'alert' | 'prompt';
  /** 标题 */
  title: string;
  /** 内容 */
  content?: ReactNode;
  /** 确认按钮文字 */
  confirmText: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 对话框类型 */
  type: DialogType;
  /** 输入框配置 */
  input?: {
    placeholder?: string;
    defaultValue?: string;
  };
  /** 确认回调 */
  onConfirm?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}
