/**
 * Monitor 监控页面
 *
 * SSH 服务器监控面板，显示服务器运行状态、资源使用情况等
 */

import { useEffect, useState } from 'react';
import { Tabs, Text, Flex, Card } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getPassword } from 'tauri-plugin-keyring-api';
import { sshGetKeyPassphrase, closeMonitorSession } from '../../command';
import { AppProvider } from '../../providers/AppProvider';
import { useMonitorParams } from '../../hooks/useMonitorParams';
import { useMonitorData } from '../../hooks/useMonitorData';
import { useMonitorStore } from '../../store/monitorStore';
import { OverviewTab } from './tabs/OverviewTab';
import { ProcessesTab } from './tabs/ProcessesTab';
import { NetworkTab } from './tabs/NetworkTab';
import { DiskTab } from './tabs/DiskTab';
import './Monitor.css';

export default function Monitor() {
  const { t } = useTranslation();
  const { sessionId, host, port, username, privateKeyPath, isValid } = useMonitorParams();
  const [password, setPassword] = useState<string | null>(null);
  const [keyPassphrase, setKeyPassphrase] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);

  // 显示窗口
  useEffect(() => {
    getCurrentWindow().show();
  }, []);

  // 从 keyring 获取凭证
  useEffect(() => {
    if (!isValid) return;

    const fetchCredentials = async () => {
      setIsLoadingCredentials(true);
      try {
        if (privateKeyPath) {
          const passphrase = await sshGetKeyPassphrase(privateKeyPath);
          const finalPassphrase = (!passphrase || passphrase === '') ? '<none>' : passphrase;
          setKeyPassphrase(finalPassphrase);
        } else {
          const pwd = await getPassword(`ssh:${username}@${host}`, username);
          if (pwd) {
            setPassword(pwd);
          } else {
            setLoadingError('Password not found in keychain');
          }
        }
      } catch (err) {
        if (privateKeyPath && err instanceof Error && err.message.includes('not found')) {
          setKeyPassphrase('<none>');
        } else {
          setLoadingError(err instanceof Error ? err.message : 'Failed to get credentials');
        }
      } finally {
        setIsLoadingCredentials(false);
      }
    };

    fetchCredentials();
  }, [isValid, host, username, privateKeyPath, t]);

  // 参数无效时显示错误
  if (!isValid) {
    return (
      <AppProvider>
        <div className="monitor-page monitor-page--error">
          <Card>
            <Flex direction="column" align="center" gap="4" p="6">
              <Text size="5" color="red">{t('monitor.error.invalidParams')}</Text>
              <Text color="gray">{t('monitor.error.invalidParamsDesc')}</Text>
            </Flex>
          </Card>
        </div>
      </AppProvider>
    );
  }

  // 凭证加载错误
  if (loadingError) {
    return (
      <AppProvider>
        <div className="monitor-page monitor-page--error">
          <Card>
            <Flex direction="column" align="center" gap="4" p="6">
              <Text size="5" color="red">Authentication Error</Text>
              <Text color="gray">{loadingError}</Text>
            </Flex>
          </Card>
        </div>
      </AppProvider>
    );
  }

  // 等待凭证加载
  if (isLoadingCredentials) {
    return (
      <AppProvider>
        <div className="monitor-page">
          <div className="monitor-loading">
            <div className="monitor-spinner" />
            {/* @ts-ignore - i18next 类型系统的限制 */}
            <Text color="gray">{t('sftp.fileList.loading')}</Text>
          </div>
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <MonitorContent
        sessionId={sessionId}
        host={host}
        port={port}
        username={username}
        password={password}
        privateKeyPath={privateKeyPath}
        keyPassphrase={keyPassphrase}
      />
    </AppProvider>
  );
}

interface MonitorContentProps {
  sessionId: string;
  host: string;
  port: number;
  username: string;
  password?: string | null;
  privateKeyPath?: string | null;
  keyPassphrase?: string | null;
}

function MonitorContent({ sessionId, host, port, username, password, privateKeyPath, keyPassphrase }: MonitorContentProps) {
  const { t } = useTranslation();
  const { status, error } = useMonitorStore();

  useMonitorData({
    sessionId,
    host,
    port,
    username,
    password: password ?? undefined,
    privateKeyPath: privateKeyPath ?? undefined,
    keyPassphrase: keyPassphrase ?? undefined,
    autoStart: true,
    refreshInterval: 5000,
  });

  // 组件卸载时清理会话
  useEffect(() => {
    return () => {
      // 调用 Rust 命令关闭监控会话
      closeMonitorSession(sessionId).catch((err) => {
        console.error('[Monitor] Failed to close session:', err);
      });
    };
  }, [sessionId]);

  return (
    <div className="monitor-page">
      {/* 页面标题 */}
      <div className="monitor-header">
        <Flex justify="between" align="center">
          <div>
            <Text size="5" weight="bold">{username}@{host}:{port}</Text>
            <Text size="2" color="gray" style={{ marginLeft: 8 }}>
              {status === 'loading' && '⏳'}
              {status === 'connected' && '🟢'}
              {status === 'error' && '🔴'}
            </Text>
          </div>
          {error && (
            <Text size="2" color="red">{error}</Text>
          )}
        </Flex>
      </div>

      {/* 标签页 */}
      <Tabs.Root defaultValue="overview" className="monitor-tabs">
        <Tabs.List>
          <Tabs.Trigger value="overview">{t('monitor.tabs.overview')}</Tabs.Trigger>
          <Tabs.Trigger value="processes">{t('monitor.tabs.processes')}</Tabs.Trigger>
          <Tabs.Trigger value="network">{t('monitor.tabs.network')}</Tabs.Trigger>
          <Tabs.Trigger value="disk">{t('monitor.tabs.disk')}</Tabs.Trigger>
        </Tabs.List>

        <div className="monitor-content">
          <Tabs.Content value="overview">
            <OverviewTab sessionId={sessionId} />
          </Tabs.Content>

          <Tabs.Content value="processes">
            <ProcessesTab sessionId={sessionId} />
          </Tabs.Content>

          <Tabs.Content value="network">
            <NetworkTab sessionId={sessionId} />
          </Tabs.Content>

          <Tabs.Content value="disk">
            <DiskTab sessionId={sessionId} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
