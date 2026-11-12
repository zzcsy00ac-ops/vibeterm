import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './PasswordDialog.css';

export interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  host: string;
  onConfirm: (password: string) => Promise<void>;
}

export function PasswordDialog({
  open,
  onOpenChange,
  username,
  host,
  onConfirm,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // 获取 Portal 容器，确保 Dialog 在 Theme 作用域内
  useEffect(() => {
    const container = document.querySelector('.app-container') as HTMLElement;
    setPortalContainer(container);
  }, []);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setPassword('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!password) {
      setError('Password cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onConfirm(password);
      setPassword('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && !isSaving) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalContainer || undefined}>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content password-dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Set Password
            </Dialog.Title>
            <button
              className="dialog-close"
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="dialog-body">
            <p className="dialog-description">
              Enter password for <strong>{username}@{host}</strong>
            </p>

            <div className="password-input-group">
              <label htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                className="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter password"
                autoFocus
                disabled={isSaving}
              />
              {error ? <span className="input-error">{error}</span> : null}
            </div>

            <p className="dialog-hint">
              Password will be encrypted and stored in system keychain
            </p>
          </div>

          <div className="dialog-footer">
            <button
              className="btn-secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!password || isSaving}
            >
              {isSaving ? 'Saving...' : 'Set Password'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
