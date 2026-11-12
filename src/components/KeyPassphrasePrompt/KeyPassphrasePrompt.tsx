import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { setPassword } from 'tauri-plugin-keyring-api';
import { Key, X } from 'lucide-react';
import './KeyPassphrasePrompt.css';

export interface KeyPassphrasePromptOptions {
  keyPath: string;
  onSubmit: (passphrase: string, save: boolean) => void;
  onCancel: () => void;
}

let resolver: ((value: { passphrase: string; save: boolean } | null) => void) | null = null;

export function showKeyPassphrasePrompt(
  options: KeyPassphrasePromptOptions
): Promise<{ passphrase: string; save: boolean } | null> {
  return new Promise((resolve) => {
    resolver = resolve;
    window.dispatchEvent(new CustomEvent('show-key-passphrase-prompt', { detail: options }));
  });
}

export function KeyPassphrasePrompt() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [saveToKeychain, setSaveToKeychain] = useState(true);
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
      const options = e.detail as KeyPassphrasePromptOptions;
      setKeyPath(options.keyPath);
      setPassphrase('');
      setSaveToKeychain(true);
      setIsOpen(true);

      // 聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener('show-key-passphrase-prompt', handleShowPrompt as EventListener);
    return () => {
      window.removeEventListener('show-key-passphrase-prompt', handleShowPrompt as EventListener);
    };
  }, []);

  const handleSubmit = async () => {
    if (!passphrase) return;

    setIsConnecting(true);

    // 如果勾选保存，先存储到 Keychain
    if (saveToKeychain) {
      try {
        const service = `ssh:key:${keyPath}`;
        await setPassword(service, keyPath, passphrase);
      } catch (error) {
        console.error('[KeyPassphrasePrompt] Failed to save passphrase:', error);
      }
    }

    setIsConnecting(false);
    setIsOpen(false);

    if (resolver) {
      resolver({ passphrase, save: saveToKeychain });
      resolver = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setPassphrase('');

    if (resolver) {
      resolver(null);
      resolver = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && passphrase && !isConnecting) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleCancel}>
      <Dialog.Portal container={portalContainer || undefined}>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content key-passphrase-prompt">
          {/* 隐藏的标题，满足可访问性要求 */}
          <VisuallyHidden.Root>
            <Dialog.Title>SSH Key Passphrase</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="prompt-header">
            <div className="prompt-title">
              <Key size={16} />
              {/* @ts-ignore - i18next 类型系统的限制 */}
              <span>{t('ssh.keyPassphrasePrompt.title')}</span>
            </div>
            <button className="close-btn" onClick={handleCancel} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="prompt-body">
            <p className="prompt-message">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('ssh.keyPassphrasePrompt.enterPassphraseFor')}
              <code className="key-path">{keyPath}</code>
            </p>

            <div className="input-group">
              {/* @ts-ignore - i18next 类型系统的限制 */}
              <label>{t('ssh.keyPassphrasePrompt.passphraseLabel')}</label>
              <input
                ref={inputRef}
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={handleKeyDown}
                // @ts-ignore - i18next 类型系统的限制 */}
                placeholder={t('ssh.keyPassphrasePrompt.passphrasePlaceholder')}
                disabled={isConnecting}
              />
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveToKeychain}
                onChange={(e) => setSaveToKeychain(e.target.checked)}
              />
              {/* @ts-ignore - i18next 类型系统的限制 */}
              <span>{t('ssh.keyPassphrasePrompt.saveToKeychain')}</span>
            </label>
          </div>

          <div className="prompt-footer">
            <button
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isConnecting}
            >
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {t('ssh.keyPassphrasePrompt.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!passphrase || isConnecting}
            >
              {/* @ts-ignore - i18next 类型系统的限制 */}
              {isConnecting ? t('ssh.keyPassphrasePrompt.connecting') : t('ssh.keyPassphrasePrompt.connect')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
