/**
 * SSH 配置对话框 - General 标签页组件
 *
 * 包含连接模式、主机、端口、用户名、认证方式等字段
 */

import { Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import type { ConnectionMode, AuthType } from '../../types/ssh';
import { AuthConfigSection } from './AuthConfigSection';
import './GeneralTab.css';

export interface GeneralTabProps {
  /** 表单数据 */
  values: {
    connectionMode?: ConnectionMode;
    host?: string;
    port?: number;
    username?: string;
    authType?: AuthType;
    hasPassword?: boolean;
    privateKeyPath?: string;
  };
  /** 字段变化回调 */
  onChange: (field: string, value: any) => void;
  /** 表单错误 */
  errors?: {
    host?: string;
  };
  /** 配置 ID（用于 Keyring） */
  profileId?: string;
}

export function GeneralTab({ values, onChange, errors }: GeneralTabProps) {
  const { t } = useTranslation();
  const connectionMode = values.connectionMode || 'direct';
  const authType = values.authType || 'auto';

  return (
    <div className="general-tab">
      {/* 连接模式 - 暂时隐藏 */}
      <div className="form-section" style={{ display: 'none' }}>
        <label className="form-label">{t('ssh.form.connectionMode')}</label>
        <Select.Root
          value={connectionMode}
          onValueChange={(value) => onChange('connectionMode', value)}
        >
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="direct">{t('ssh.connectionModes.direct')}</Select.Item>
            {/* 其他模式暂未实现 */}
            <Select.Item value="jumpHost" disabled>{t('ssh.connectionModes.jumpHost')}</Select.Item>
            <Select.Item value="socksProxy" disabled>{t('ssh.connectionModes.socksProxy')}</Select.Item>
            <Select.Item value="httpProxy" disabled>{t('ssh.connectionModes.httpProxy')}</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      {/* 直接连接模式 */}
      {connectionMode === 'direct' && (
        <>
          {/* 主机和端口 */}
          <div className="form-row">
            <div className="form-field flex-1">
              <label htmlFor="host" className="form-label">
                {t('ssh.form.host')} <span className="required">*</span>
              </label>
              <input
                id="host"
                type="text"
                className={`form-input ${errors?.host ? 'input-error' : ''}`}
                placeholder={t('ssh.placeholders.host')}
                value={values.host || ''}
                onChange={(e) => onChange('host', e.target.value)}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              {errors?.host ? <span className="error-text">{errors.host}</span> : null}
            </div>
            <div className="form-field w-24">
              <label htmlFor="port" className="form-label">{t('ssh.form.port')}</label>
              <input
                id="port"
                type="number"
                className="form-input"
                placeholder={t('ssh.placeholders.port')}
                min={1}
                max={65535}
                value={values.port || 22}
                onChange={(e) => onChange('port', parseInt(e.target.value) || 22)}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
          </div>

          {/* 用户名 */}
          <div className="form-field">
            <label htmlFor="username" className="form-label">{t('ssh.form.username')}</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder={t('ssh.placeholders.username')}
              value={values.username || ''}
              onChange={(e) => onChange('username', e.target.value)}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <span className="field-hint">可选</span>
          </div>
        </>
      )}

      {/* 认证配置 */}
      <AuthConfigSection
        authType={authType}
        username={values.username}
        host={values.host}
        hasPassword={values.hasPassword}
        privateKeyPath={values.privateKeyPath}
        onChange={onChange}
      />
    </div>
  );
}
