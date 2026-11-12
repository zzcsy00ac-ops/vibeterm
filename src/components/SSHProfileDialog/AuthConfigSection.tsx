import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { Zap, Key, FileKey } from 'lucide-react';
import type { AuthType } from '../../types/ssh';
import { LoadingSpinner } from '../ui/LoadingSpinner';

// 懒加载认证配置组件
const PasswordSection = lazy(() => import('./PasswordSection').then(m => ({ default: m.PasswordSection })));
const PrivateKeySection = lazy(() => import('./PrivateKeySection').then(m => ({ default: m.PrivateKeySection })));

export interface AuthConfigSectionProps {
  authType: AuthType;
  username?: string;
  host?: string;
  hasPassword?: boolean;
  privateKeyPath?: string;
  onChange: (field: string, value: any) => void;
}

export function AuthConfigSection({
  authType,
  username,
  host,
  privateKeyPath,
  onChange,
}: AuthConfigSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="auth-config-section">
      {/* 认证方式选择器 */}
      <div className="form-section">
        <label className="form-label">{t('ssh.form.authType')}</label>
        <RadioGroup.Root
          value={authType}
          onValueChange={(value) => onChange('authType', value)}
          className="radio-group"
        >
          <div className="radio-option">
            <RadioGroup.Item value="auto" id="auth-auto" className="radio-item" />
            <label htmlFor="auth-auto" className="radio-label">
              <Zap size={16} className="radio-icon" />
              <span>{t('ssh.authTypes.auto')}</span>
            </label>
          </div>
          <div className="radio-option">
            <RadioGroup.Item value="password" id="auth-password" className="radio-item" />
            <label htmlFor="auth-password" className="radio-label">
              <Key size={16} className="radio-icon" />
              <span>{t('ssh.authTypes.password')}</span>
            </label>
          </div>
          <div className="radio-option">
            <RadioGroup.Item value="key" id="auth-key" className="radio-item" />
            <label htmlFor="auth-key" className="radio-label">
              <FileKey size={16} className="radio-icon" />
              <span>{t('ssh.authTypes.key')}</span>
            </label>
          </div>
        </RadioGroup.Root>
      </div>

      {/* 认证方法配置 - 懒加载 */}
      {(authType === 'auto' || authType === 'password') && (
        <div className="form-section">
          <Suspense fallback={<LoadingSpinner message="加载密码配置..." />}>
            <PasswordSection
              username={username}
              host={host}
              onPasswordSet={() => {
                onChange('hasPassword', true);
              }}
              onPasswordForgotten={() => {
                onChange('hasPassword', false);
              }}
            />
          </Suspense>
        </div>
      )}

      {(authType === 'auto' || authType === 'key') && (
        <div className="form-section">
          <Suspense fallback={<LoadingSpinner message="加载密钥配置..." />}>
            <PrivateKeySection
              privateKeyPath={privateKeyPath}
              onKeyChange={(path: string | undefined) => onChange('privateKeyPath', path)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
