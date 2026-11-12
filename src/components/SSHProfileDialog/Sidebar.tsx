/**
 * SSH 配置对话框 - 侧边栏组件
 *
 * 包含名称、分组、图标三个字段
 */

import { Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  Server,
  Database,
  Cloud,
  Globe,
  Wrench,
  Factory,
  Beaker,
  HardDrive,
  type LucideIcon,
} from 'lucide-react';
import { useSSHStore } from '../../store/sshStore';
import './Sidebar.css';

export interface SidebarProps {
  /** 表单数据 */
  values: {
    name?: string;
    groupId?: string;
    icon?: string;
  };
  /** 字段变化回调 */
  onChange: (field: string, value: string) => void;
  /** 表单错误 */
  errors?: {
    name?: string;
  };
}

// 图标配置（key 用于翻译）
const ICON_OPTIONS: Array<{ value: string; key: string; icon: LucideIcon }> = [
  { value: 'server', key: 'ssh.icons.server', icon: Server },
  { value: 'database', key: 'ssh.icons.database', icon: Database },
  { value: 'cloud', key: 'ssh.icons.cloud', icon: Cloud },
  { value: 'network', key: 'ssh.icons.network', icon: Globe },
  { value: 'development', key: 'ssh.icons.development', icon: Wrench },
  { value: 'production', key: 'ssh.icons.production', icon: Factory },
  { value: 'staging', key: 'ssh.icons.staging', icon: Beaker },
  { value: 'backup', key: 'ssh.icons.backup', icon: HardDrive },
];

export function Sidebar({ values, onChange, errors }: SidebarProps) {
  const { t } = useTranslation();
  const groups = useSSHStore(state => state.getGroups());

  // 获取当前选中的图标组件
  const SelectedIcon = ICON_OPTIONS.find(i => i.value === values.icon)?.icon;

  return (
    <aside className="ssh-dialog-sidebar">
      {/* 名称字段 */}
      <div className="sidebar-section">
        <label htmlFor="profile-name" className="sidebar-label">
          {t('ssh.sidebar.name')} <span className="required">*</span>
        </label>
        <input
          id="profile-name"
          type="text"
          className={`sidebar-input ${errors?.name ? 'input-error' : ''}`}
          placeholder={t('ssh.sidebar.namePlaceholder')}
          value={values.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {errors?.name ? <span className="error-text">{errors.name}</span> : null}
      </div>

      {/* 分组选择 */}
      <div className="sidebar-section">
        <label htmlFor="profile-group" className="sidebar-label">
          {t('ssh.sidebar.group')}
        </label>
        <Select.Root
          value={values.groupId || 'none'}
          onValueChange={(value) => onChange('groupId', value === 'none' ? '' : value)}
          disabled
        >
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="none">{t('ssh.sidebar.noGroup')}</Select.Item>
            {groups.map(group => (
              <Select.Item key={group.id} value={group.id}>
                {group.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>

      {/* 图标选择 */}
      <div className="sidebar-section">
        <label htmlFor="profile-icon" className="sidebar-label">
          {t('ssh.sidebar.icon')}
        </label>
        <Select.Root
          value={values.icon || 'none'}
          onValueChange={(value) => onChange('icon', value === 'none' ? '' : value)}
        >
          <Select.Trigger>
            {SelectedIcon && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SelectedIcon size={16} />
              </div>
            )}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="none">{t('ssh.sidebar.noIcon')}</Select.Item>
            {ICON_OPTIONS.map(icon => (
              <Select.Item key={icon.value} value={icon.value}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <icon.icon size={16} />
                  <span>{t(icon.key as any)}</span>
                </div>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
    </aside>
  );
}
