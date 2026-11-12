/**
 * 通用 Dialog 组件
 *
 * 通过 ref 方法调用的命令式对话框组件
 * 自动挂载到 .app-container 避免 transform 容器的 position:fixed 问题
 */

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
  useCallback,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import * as RadixDialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import type {
  DialogRef,
  ConfirmOptions,
  AlertOptions,
  PromptOptions,
  DialogState,
} from './types';
import './Dialog.css';

interface DialogProps {
  dialogRef?: React.Ref<DialogRef>;
  nested?: boolean; // 是否为嵌套对话框（在另一个对话框内部打开）
}

const DialogComponent: FC<DialogProps> = (props) => {
  const { t } = useTranslation();
  const { nested = false } = props;

  const [state, setState] = useState<DialogState>({
    open: false,
    mode: 'confirm',
    title: '',
    confirmText: t('common.buttons.confirm'),
    type: 'default',
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 获取 .app-container 作为 Portal 挂载点
  useEffect(() => {
    const container = document.querySelector('.app-container') as HTMLElement;
    setPortalContainer(container);
  }, []);

  // 关闭对话框
  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  // 处理确认
  const handleConfirm = useCallback(() => {
    state.onConfirm?.();
    close();
  }, [state.onConfirm, close]);

  // 处理取消
  const handleCancel = useCallback(() => {
    state.onCancel?.();
    close();
  }, [state.onCancel, close]);

  // 打开确认对话框
  const confirm = useCallback((options: ConfirmOptions) => {
    setState({
      open: true,
      mode: 'confirm',
      title: options.title,
      content: options.content || <div className="dialog-message">{options.message}</div>,
      confirmText: options.confirmText || t('common.buttons.confirm'),
      cancelText: options.cancelText || t('common.buttons.cancel'),
      type: options.type || 'default',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, [t]);

  // 打开提示对话框
  const alert = useCallback((options: AlertOptions) => {
    setState({
      open: true,
      mode: 'alert',
      title: options.title,
      content: options.content || <div className="dialog-message">{options.message}</div>,
      confirmText: options.buttonText || t('common.buttons.ok'),
      type: 'default',
      onConfirm: options.onButtonClick,
    });
  }, [t]);

  // 打开输入对话框
  const prompt = useCallback((options: PromptOptions) => {
    setState({
      open: true,
      mode: 'prompt',
      title: options.title,
      content: options.content || <div className="dialog-message">{options.message}</div>,
      confirmText: options.confirmText || t('common.buttons.confirm'),
      cancelText: options.cancelText || t('common.buttons.cancel'),
      type: 'default',
      input: {
        placeholder: options.placeholder,
        defaultValue: options.defaultValue,
      },
      onConfirm: () => {
        const value = inputRef.current?.value || '';
        options.onConfirm?.(value);
      },
      onCancel: options.onCancel,
    });
  }, [t]);

  // 暴露 ref 方法
  useImperativeHandle<DialogRef, DialogRef>(
    props.dialogRef,
    () => ({
      confirm,
      alert,
      prompt,
    }),
    [confirm, alert, prompt]
  );

  // 对话框打开时自动聚焦输入框，光标移到末尾
  useEffect(() => {
    if (state.open && state.mode === 'prompt') {
      setTimeout(() => {
        const input = inputRef.current;
        if (input) {
          input.focus();
          // 将光标移到末尾，不选中任何文本
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      }, 0);
    }
  }, [state.open, state.mode]);

  return (
    <RadixDialog.Root open={state.open} onOpenChange={(open: boolean) => !open && close()}>
      <RadixDialog.Portal container={portalContainer || undefined}>
        <RadixDialog.Overlay
          className={nested ? "dialog-overlay dialog-overlay--nested" : "dialog-overlay"}
          style={{ zIndex: nested ? 'var(--z-nested-modal-backdrop)' : 'var(--z-modal-backdrop)' }}
        />
        <RadixDialog.Content
          className={nested ? "dialog-content dialog-content--nested" : "dialog-content"}
          style={{ zIndex: nested ? 'var(--z-nested-modal)' : 'var(--z-modal)' }}
          onEscapeKeyDown={handleCancel}
        >
          {/* 标题 */}
          <RadixDialog.Title className={state.title ? "dialog-title" : "dialog-title dialog-title--hidden"}>
            {state.type === 'danger' ? <AlertTriangle className="dialog-icon dialog-icon--danger" /> : null}
            {state.type === 'warning' ? <AlertTriangle className="dialog-icon dialog-icon--warning" /> : null}
            {state.title || 'Dialog'}
          </RadixDialog.Title>

          {/* 内容 */}
          <RadixDialog.Description className="dialog-description" asChild>
            <div>
              {state.content}
            </div>
          </RadixDialog.Description>

          {/* 输入框（仅 prompt 模式） */}
          {state.mode === 'prompt' && state.input ? (
            <input
              ref={inputRef}
              type="text"
              className="dialog-input"
              placeholder={state.input.placeholder}
              defaultValue={state.input.defaultValue}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
          ) : null}

          {/* 按钮 */}
          <div className="dialog-footer">
            {state.mode !== 'alert' && (
              <button
                className="dialog-button dialog-button--cancel"
                onClick={handleCancel}
              >
                {state.cancelText}
              </button>
            )}
            <button
              className={`dialog-button dialog-button--confirm dialog-button--${state.type}`}
              onClick={handleConfirm}
            >
              {state.confirmText}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

// 导出 forwardRef 组件
const DialogInner = forwardRef<DialogRef, DialogProps>((props, ref) => (
  <DialogComponent dialogRef={ref} {...props} />
));

DialogInner.displayName = 'Dialog';

export { DialogInner as Dialog };
