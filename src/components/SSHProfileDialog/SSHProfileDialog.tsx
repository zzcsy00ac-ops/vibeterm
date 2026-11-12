/**
 * SSH 配置对话框主组件
 *
 * 整合侧边栏和 General 标签页，使用 React Hook Form + Zod 进行表单验证
 */

import * as Dialog from '@radix-ui/react-dialog';
import * as Separator from '@radix-ui/react-separator';
import { forwardRef, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useSSHStore } from '../../store/sshStore';
import { useAppStore } from '../../store/appStore';
import { sshConnect, sshClose, sshGetKeyPassphrase } from '../../command';
import { getPassword } from 'tauri-plugin-keyring-api';
import { listen } from '@tauri-apps/api/event';
import type { SSHProfileFormData, ConnectionMode, AuthType } from '../../types/ssh';
import { Sidebar } from './Sidebar';
import { GeneralTab } from './GeneralTab';
import './SSHProfileDialog.css';

/**
 * 验证主机地址格式
 * 支持：域名、IPv4、localhost
 */
function isValidHost(value: string): boolean {
  if (!value || value.trim().length === 0) return false;

  const trimmed = value.trim();

  // localhost
  if (trimmed === 'localhost') return true;

  // IPv4 地址 (如 192.168.1.1)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = trimmed.match(ipv4Regex);
  if (ipv4Match) {
    // 每个段必须在 0-255 之间
    return ipv4Match.slice(1, 5).every(segment => {
      const num = parseInt(segment, 10);
      return num >= 0 && num <= 255;
    });
  }

  // 域名格式 (如 example.com, sub.example.com)
  // 至少一个点，由字母、数字、连字符组成，每个标签不超过 63 字符
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
  if (domainRegex.test(trimmed) && trimmed.includes('.')) {
    return true;
  }

  // 单个主机名（无点，如 server-name）
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
  if (hostnameRegex.test(trimmed)) {
    return true;
  }

  return false;
}

// 创建验证 schema 的函数（支持 i18n）
const createSSHProfileSchema = (t: (key: string) => string) => z.object({
  // 侧边栏字段
  name: z.string().min(1, t('ssh.validation.nameRequired')),
  groupId: z.string().optional(),
  icon: z.string().optional(),

  // General 标签页
  connectionMode: z.enum(['direct', 'jumpHost', 'socksProxy', 'httpProxy']),
  host: z.string()
    .min(1, t('ssh.validation.hostRequired'))
    .refine(isValidHost, t('ssh.validation.hostInvalid')),
  port: z.number().min(1).max(65535),
  username: z.string().optional(),
  authType: z.enum(['auto', 'password', 'key', 'agent', 'keyboardInteractive']),
  hasPassword: z.boolean().optional(),
  privateKeyPath: z.string().optional(),

  // 高级选项（预留，暂未实现 UI）
  x11: z.boolean().optional(),
  agentForward: z.boolean().optional(),
  skipBanner: z.boolean().optional(),
  reuseSession: z.boolean().optional(),
  keepaliveInterval: z.number().optional(),
  keepaliveCountMax: z.number().optional(),
  readyTimeout: z.number().optional(),

  // 代理配置（预留，暂未实现 UI）
  jumpHostId: z.string().optional(),
  socksProxyHost: z.string().optional(),
  socksProxyPort: z.number().optional(),
  httpProxyHost: z.string().optional(),
  httpProxyPort: z.number().optional(),
  privateKeys: z.array(z.string()).optional(),
}).transform(data => ({
  ...data,
  connectionMode: data.connectionMode || 'direct',
  host: data.host,
  port: data.port || 22,
  authType: data.authType || 'auto',
}));

export interface SSHProfileDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 模式：创建或编辑 */
  mode?: 'create' | 'edit';
  /** 编辑模式下的配置 ID */
  profileId?: string;
  /** 编辑模式下的默认值（已弃用，使用 profileId） */
  defaultValues?: Partial<SSHProfileFormData>;
  /** 父分组 ID（创建时使用） */
  parentGroupId?: string;
  /** 创建成功后的回调 */
  onSuccess?: (profileId: string) => void;
}

export const SSHProfileDialog = forwardRef<HTMLDivElement, SSHProfileDialogProps>(
  ({ open, onOpenChange, mode = 'create', profileId, defaultValues, parentGroupId, onSuccess }, ref) => {
    const { t } = useTranslation();
    const addProfile = useSSHStore(state => state.addProfile);
    const updateProfile = useSSHStore(state => state.updateProfile);
    const getProfile = useSSHStore(state => state.getProfile);
    const addTab = useAppStore(state => state.addTab);

    // 测试连接状态
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 使用 useState 初始化，确保首次渲染时就有值
    const [portalContainer] = useState<HTMLDivElement | null>(() =>
      document.querySelector('.app-container') as HTMLDivElement
    );

    // 创建支持 i18n 的 schema
    const sshProfileSchema = createSSHProfileSchema(t as any);

    const {
      handleSubmit,
      watch,
      setValue,
      formState: { errors },
      reset,
    } = useForm<SSHProfileFormData>({
      resolver: zodResolver(sshProfileSchema),
      defaultValues: {
        port: 22,
        connectionMode: 'direct' as ConnectionMode,
        authType: 'auto' as AuthType,
        reuseSession: true,
        groupId: parentGroupId,
        ...defaultValues,
      },
    });

    // 监听表单值变化
    const formValues = watch();

    // 重置表单当对话框打开时
    useEffect(() => {
      if (open) {
        if (mode === 'edit' && profileId) {
          // 编辑模式：从 store 加载配置数据
          const profile = getProfile(profileId);
          if (profile) {
            reset({
              name: profile.name,
              groupId: profile.groupId || undefined,
              icon: profile.icon,
              connectionMode: profile.connectionMode,
              host: profile.host,
              port: profile.port,
              username: profile.username,
              authType: profile.authType,
              hasPassword: profile.hasPassword,
              privateKeyPath: profile.privateKeyPath,
              x11: profile.x11,
              agentForward: profile.agentForward,
              skipBanner: profile.skipBanner,
              reuseSession: profile.reuseSession,
              keepaliveInterval: profile.keepaliveInterval,
              keepaliveCountMax: profile.keepaliveCountMax,
              readyTimeout: profile.readyTimeout,
            });
          }
        } else {
          // 创建模式：使用默认值
          reset({
            port: 22,
            connectionMode: 'direct' as ConnectionMode,
            authType: 'auto' as AuthType,
            reuseSession: true,
            groupId: parentGroupId,
            ...defaultValues,
          });
        }
      }
    }, [open, mode, profileId, parentGroupId, defaultValues, reset, getProfile]);

    // 测试连接函数
    const handleTestConnection = async () => {
      const values = watch();
      if (!values.host || !values.username) {
        setTestResult({ success: false, message: t('connectionTest.fillRequired') });
        return;
      }

      setIsTesting(true);
      setTestResult(null);

      let sessionId = '';
      const unlistenPromises: Promise<() => void>[] = [];

      try {
        sessionId = `test-${Date.now()}`;

        // 准备认证凭据
        let password: string | undefined;
        let keyPassphrase: string | undefined;

        if (values.privateKeyPath) {
          // 使用私钥认证：尝试从 Keychain 获取密码短语
          try {
            const savedPassphrase = await sshGetKeyPassphrase(values.privateKeyPath);
            if (savedPassphrase) {
              keyPassphrase = savedPassphrase;
            }
          } catch {
            // Keychain 中没有密码短语
          }
        } else {
          // 使用密码认证：尝试从 Keychain 获取密码
          try {
            const service = `ssh:${values.username}@${values.host}`;
            const savedPassword = await getPassword(service, values.username);
            if (savedPassword) {
              password = savedPassword;
            }
          } catch {
            // Keychain 中没有密码
          }
        }

        // 监听需要密码短语事件
        const unlistenNeedPassphrase = listen(
          `ssh://need_passphrase/${sessionId}`,
          async () => {
            // 私钥需要密码短语，但测试连接时不显示对话框
            // 直接显示错误提示用户先保存并连接
            setTestResult({
              success: false,
              message: 'Key passphrase required. Please use "Save and Connect" to enter passphrase.',
            });
          }
        );
        unlistenPromises.push(unlistenNeedPassphrase);

        await sshConnect({
          session_id: sessionId,
          host: values.host,
          port: values.port || 22,
          username: values.username,
          password: password,
          private_key_path: values.privateKeyPath,
          key_passphrase: keyPassphrase,
          cols: 80,
          rows: 24,
        });

        setTestResult({ success: true, message: t('connectionTest.success') });

        // 测试成功后立即关闭 session
        try {
          await sshClose(sessionId);
        } catch {
          // 忽略关闭失败
        }
      } catch (error) {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : t('connectionTest.failed'),
        });
      } finally {
        setIsTesting(false);
        // 清理事件监听
        Promise.all(unlistenPromises).then((unlisteners) => {
          unlisteners.forEach((unlisten) => unlisten());
        });
      }
    };

    // 测试连接后打开终端
    const handleTestAndConnect = async () => {
      const values = watch();
      if (!values.host || !values.username) {
        setTestResult({ success: false, message: t('connectionTest.fillRequired') });
        return;
      }

      // 先保存配置（如果是创建模式）
      let targetProfileId = profileId;
      if (mode === 'create') {
        // 临时创建一个 profile
        targetProfileId = addProfile({
          ...values,
          groupId: values.groupId || null,
        });
      }

      // 测试连接并打开终端
      setIsTesting(true);
      setTestResult(null);

      try {
        const sessionId = `${targetProfileId}-${Date.now()}`;

        // 准备认证凭据
        let password: string | undefined;
        let keyPassphrase: string | undefined;

        if (values.privateKeyPath) {
          // 使用私钥认证：尝试从 Keychain 获取密码短语
          try {
            const savedPassphrase = await sshGetKeyPassphrase(values.privateKeyPath);
            if (savedPassphrase) {
              keyPassphrase = savedPassphrase;
            }
          } catch {
            // Keychain 中没有密码短语
          }
        } else {
          // 使用密码认证：尝试从 Keychain 获取密码
          try {
            const service = `ssh:${values.username}@${values.host}`;
            const savedPassword = await getPassword(service, values.username);
            if (savedPassword) {
              password = savedPassword;
            }
          } catch {
            // Keychain 中没有密码
          }
        }

        await sshConnect({
          session_id: sessionId,
          host: values.host,
          port: values.port || 22,
          username: values.username,
          password: password,
          private_key_path: values.privateKeyPath,
          key_passphrase: keyPassphrase,
          cols: 80,
          rows: 24,
        });

        // 连接成功，关闭对话框并打开终端标签页
        onOpenChange(false);
        addTab({
          title: values.name || `${values.username}@${values.host}`,
          key: 'ssh-terminal',
          params: {
            sessionId,
            host: values.host,
            port: values.port || 22,
            username: values.username,
          },
        });
      } catch (error) {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : t('connectionTest.failed'),
        });
      } finally {
        setIsTesting(false);
      }
    };

    const onSubmit = (data: SSHProfileFormData) => {
      try {
        if (mode === 'edit' && profileId) {
          // 编辑模式：更新现有配置
          updateProfile(profileId, {
            ...data,
            groupId: data.groupId || null,
          });
          onSuccess?.(profileId);
        } else {
          // 创建模式：添加新配置
          const newProfileId = addProfile({
            ...data,
            groupId: data.groupId || null,
          });
          onSuccess?.(newProfileId);
        }

        // 重置表单
        reset();

        // 关闭对话框
        onOpenChange(false);
      } catch (error) {
        // 保存失败，忽略
      }
    };

    const handleFieldChange = (field: string, value: any) => {
      setValue(field as any, value);
    };

    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={portalContainer || undefined}>
          <Dialog.Overlay className="ssh-dialog-overlay" />
          <Dialog.Content className="ssh-dialog-content" ref={ref}>
            <Dialog.Title className="ssh-dialog-title">
              {mode === 'create' ? t('ssh.dialogs.createProfile') : t('ssh.dialogs.editProfile')}
            </Dialog.Title>

            <div className="ssh-dialog-body">
              {/* 左侧侧边栏 */}
              <Sidebar
                values={{
                  name: formValues.name,
                  groupId: formValues.groupId,
                  icon: formValues.icon,
                }}
                onChange={handleFieldChange}
                errors={{
                  name: errors.name?.message,
                }}
              />

              <Separator.Root orientation="vertical" className="ssh-dialog-separator" />

              {/* 右侧内容区域 */}
              <div className="ssh-dialog-main">
                <GeneralTab
                  values={{
                    connectionMode: formValues.connectionMode,
                    host: formValues.host,
                    port: formValues.port,
                    username: formValues.username,
                    authType: formValues.authType,
                    hasPassword: formValues.hasPassword,
                    privateKeyPath: formValues.privateKeyPath,
                  }}
                  onChange={handleFieldChange}
                  errors={{
                    host: errors.host?.message,
                  }}
                  profileId={profileId}
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="ssh-dialog-footer">
              {/* 左侧：测试结果 */}
              <div className="ssh-dialog-footer-left">
                {testResult && (
                  <span className={`test-result ${testResult.success ? 'test-success' : 'test-error'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>

              {/* 右侧：按钮组 */}
              <div className="ssh-dialog-footer-right">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onOpenChange(false)}
                >
                  {t('ssh.buttons.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formValues.host || !formValues.username}
                >
                  {isTesting ? t('connectionTest.testing') : t('connectionTest.testButton')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit(onSubmit)}
                >
                  {mode === 'create' ? t('ssh.buttons.create') : t('ssh.buttons.save')}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleTestAndConnect}
                  disabled={isTesting || !formValues.host || !formValues.username}
                >
                  {isTesting ? t('connectionTest.connecting') : t('connectionTest.saveAndConnect')}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

SSHProfileDialog.displayName = 'SSHProfileDialog';
