/**
 * SudoPasswordDialog - Sudo 密码输入弹窗
 *
 * 当检测到 sudo 密码提示时显示，通过本地弹窗获取密码输入
 * 密码通过 SSH 加密通道发送，完全隔离于 AI
 *
 * 支持"1小时内免提示"功能：用户可选择保存密码到 keychain
 */

import { useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  ShieldCheck,
  Lock,
  Terminal,
  Server,
  User,
  ChevronRight,
} from 'lucide-react';
import { Dialog } from '../Dialog';
import type { DialogRef } from '../Dialog/types';
import { useTranslation } from 'react-i18next';
import './SudoPasswordDialog.css';

interface SudoPasswordRequest {
  session_id: string;
  host: string;
  username: string;
  command: string;
  promptText: string;
  can_save: boolean;
}

export function SudoPasswordDialog() {
  const { t } = useTranslation();
  const dialogRef = useRef<DialogRef>(null);

  // 监听 sudo 密码请求事件
  useEffect(() => {
    let unlisten: () => void;

    listen<SudoPasswordRequest>('sudo-password-request', (event) => {
      console.log('[SudoPasswordDialog] Password request received:', event.payload);
      const request = event.payload;
      const dialog = dialogRef.current;

      if (dialog) {
        dialog.confirm({
          title: t('ssh.sudo.title'),
          content: (
            <div className="sudo-password-content">
              {/* 安全保证说明 */}
              <div className="sudo-security-section">
                <div className="section-header">
                  <ShieldCheck size={16} className="section-icon" aria-hidden="true" />
                  <span className="section-title">Security Guarantee</span>
                </div>
                <div className="security-items">
                  <div className="security-item">
                    <Lock size={14} className="item-icon" aria-hidden="true" />
                    <span>{t('ssh.sudo.securityLocal')}</span>
                  </div>
                  <div className="security-item">
                    <ShieldCheck size={14} className="item-icon" aria-hidden="true" />
                    <span>{t('ssh.sudo.securityEncrypted')}</span>
                  </div>
                  <div className="security-item">
                    <Lock size={14} className="item-icon" aria-hidden="true" />
                    <span>{t('ssh.sudo.securityNoAI')}</span>
                  </div>
                </div>
              </div>

              {/* 连接信息 */}
              <div className="sudo-connection-info">
                <div className="info-item">
                  <Server size={14} className="info-icon" aria-hidden="true" />
                  <span className="info-label">{t('ssh.sudo.host')}:</span>
                  <span className="info-value">{request.host}</span>
                </div>
                <div className="info-item">
                  <User size={14} className="info-icon" aria-hidden="true" />
                  <span className="info-label">{t('ssh.sudo.user')}:</span>
                  <span className="info-value">{request.username}</span>
                </div>
                <div className="info-item command-item">
                  <Terminal size={14} className="info-icon" aria-hidden="true" />
                  <span className="info-label">{t('ssh.sudo.command')}:</span>
                  <span className="info-value">{request.command}</span>
                </div>
              </div>

              {/* 密码输入区域 */}
              <div className="sudo-password-input-wrapper">
                <label htmlFor="sudo-password-input" className="visually-hidden">
                  {t('ssh.sudo.passwordLabel')}
                </label>
                <input
                  id="sudo-password-input"
                  type="password"
                  className="sudo-password-input"
                  placeholder={`${t('ssh.sudo.passwordLabel')}…`}
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const confirmBtn = document.querySelector('.dialog-button--confirm') as HTMLButtonElement;
                      confirmBtn?.click();
                    }
                  }}
                />

                {/* 1小时内免提示复选框 */}
                {request.can_save && (
                  <label className="sudo-save-option">
                    <input type="checkbox" id="save-password" name="save-password" spellCheck={false} />
                    <span className="checkbox-text">
                      {t('ssh.sudo.saveCheckbox')}
                      <ChevronRight size={14} className="chevron" aria-hidden="true" />
                    </span>
                  </label>
                )}

                {/* 安全提示 */}
                <p className="sudo-security-hint">
                  <ShieldCheck size={14} className="hint-icon" aria-hidden="true" />
                  {t('ssh.sudo.saveHint')}
                </p>
              </div>
            </div>
          ),
          confirmText: t('ssh.sudo.submit'),
          cancelText: t('ssh.sudo.cancel'),
          type: 'default',
          onConfirm: async () => {
            const passwordInput = document.getElementById('sudo-password-input') as HTMLInputElement;
            const saveCheckbox = document.getElementById('save-password') as HTMLInputElement;

            const password = passwordInput?.value;
            const savePassword = saveCheckbox?.checked || false;

            if (!password) {
              passwordInput?.focus();
              return;
            }

            console.log('[SudoPasswordDialog] Submitting for:', request.session_id, 'save:', savePassword);

            try {
              await invoke('submit_sudo_password', {
                sessionId: request.session_id,
                password,
                saveToKeychain: savePassword,
                host: request.host,
                username: request.username,
              });
            } catch (error) {
              console.error('[SudoPasswordDialog] Failed to submit password:', error);
              throw error;
            }
          },
          onCancel: async () => {
            console.log('[SudoPasswordDialog] User cancelled for:', request.session_id);
            try {
              await invoke('cancel_sudo_password', {
                sessionId: request.session_id,
              });
            } catch (error) {
              console.error('[SudoPasswordDialog] Failed to cancel password:', error);
            }
          },
        });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [t]);

  return <Dialog ref={dialogRef} />;
}
