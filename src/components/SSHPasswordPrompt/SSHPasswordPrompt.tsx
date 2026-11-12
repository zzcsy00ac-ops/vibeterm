import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { setPassword } from 'tauri-plugin-keyring-api';
import { X } from 'lucide-react';
import './SSHPasswordPrompt.css';

export interface PasswordPromptOptions {
  username: string;
  host: string;
  onSubmit: (password: string, savePassword: boolean) => void;
  onCancel: () => void;
}

let promptResolver: ((value: { password: string; save: boolean } | null) => void) | null = null;

export function showPasswordPrompt(options: PasswordPromptOptions): Promise<{ password: string; save: boolean } | null> {
  return new Promise((resolve) => {
    promptResolver = resolve;
    window.dispatchEvent(new CustomEvent('show-ssh-password-prompt', { detail: options }));
  });
}

export function SSHPasswordPrompt() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [host, setHost] = useState('');
  const [password, setLocalPassword] = useState('');
  const [savePassword, setSavePassword] = useState(false); // 默认不选中
  const [isConnecting, setIsConnecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 获取 Portal 容器，确保 Dialog 在 Theme 作用域内
  useEffect(() => {
    const container = document.querySelector('.app-container') as HTMLElement;
    setPortalContainer(container);
  }, []);

  useEffect(() => {
    const handleShowPrompt = (e: CustomEvent) => {
      const options = e.detail as PasswordPromptOptions;
      setUsername(options.username);
      setHost(options.host);
      setLocalPassword('');
      setSavePassword(false); // 重置为不选中
      setIsOpen(true);

      // 聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener('show-ssh-password-prompt', handleShowPrompt as EventListener);
    return () => {
      window.removeEventListener('show-ssh-password-prompt', handleShowPrompt as EventListener);
    };
  }, []);

  const handleSubmit = async () => {
    if (!password) return;

    setIsConnecting(true);

    // 如果选择保存密码，先存储到 Keychain
    if (savePassword) {
      try {
        const service = `ssh:${username}@${host}`;
        await setPassword(service, username, password);
      } catch (error) {
        console.error('[SSHPasswordPrompt] Failed to save password:', error);
        // 保存失败不影响连接
      }
    }

    setIsOpen(false);
    setIsConnecting(false);

    if (promptResolver) {
      promptResolver({ password, save: savePassword });
      promptResolver = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setLocalPassword('');
    setSavePassword(false);

    if (promptResolver) {
      promptResolver(null);
      promptResolver = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && !isConnecting) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleCancel}>
      <Dialog.Portal container={portalContainer || undefined}>
        <Dialog.Overlay className="ssh-password-prompt-overlay" />
        <Dialog.Content className="ssh-password-prompt">
          {/* 隐藏的标题，满足可访问性要求 */}
          <VisuallyHidden.Root>
            <Dialog.Title>SSH Password Authentication</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="prompt-header">
            {/* @ts-ignore - i18next 类型系统的限制 */}
            <h2>{t('ssh.passwordPrompt.title')}</h2>
            <button className="close-btn" onClick={handleCancel}>
              <X size={16} />
            </button>
          </div>

          <div className="prompt-body">
            <p
              className="prompt-message"
              // @ts-ignore - i18next 类型系统的限制
              dangerouslySetInnerHTML={{
                __html: t('ssh.passwordPrompt.enterPasswordFor', {
                  user: username,
                  host: host,
                  interpolation: { escapeValue: false },
                }),
              }}
            />

            <div className="password-input-wrapper">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              <label>{t('ssh.passwordPrompt.passwordLabel')}</label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setLocalPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                // @ts-ignore - i18next 类型系统的限制
                placeholder={t('ssh.passwordPrompt.passwordPlaceholder')}
                disabled={isConnecting}
              />
            </div>

            <label className="save-password-checkbox">
              <input
                type="checkbox"
                checked={savePassword}
                onChange={(e) => setSavePassword(e.target.checked)}
              />
              {/* @ts-ignore - i18next 类型系统的限制 */}
              <span>{t('ssh.passwordPrompt.savePasswordToKeychain')}</span>
            </label>
          </div>

          <div className="prompt-footer">
            <button
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isConnecting}
            >
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('ssh.passwordPrompt.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!password || isConnecting}
            >
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {isConnecting ? t('ssh.passwordPrompt.connecting') : t('ssh.passwordPrompt.connect')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
