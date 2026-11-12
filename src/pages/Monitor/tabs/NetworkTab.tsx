/**
 * Network Tab - 网络详情
 */

import { useMemo } from 'react';
import { Card, Grid, Text, Flex, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Network } from 'lucide-react';
import { useMonitorStore } from '../../../store/monitorStore';
import { NetworkChart } from '../../../components/charts/NetworkChart';
import { formatBandwidth } from '../../../hooks/useMonitorData';

interface NetworkTabProps {
  sessionId: string;
}

export function NetworkTab({ sessionId: _sessionId }: NetworkTabProps) {
  const { t } = useTranslation();
  const { metrics, history, networkConnections } = useMonitorStore();

  // 格式化历史数据用于图表
  const chartData = useMemo(() => {
    return history.map((point) => ({
      time: point.time,
      uploadRate: point.uploadRate,
      downloadRate: point.downloadRate,
    }));
  }, [history]);

  return (
    <div className="tab-content">
      {/* 上传/下载速率卡片 */}
      <Grid columns="2" gap="4" mb="4">
        <NetworkStatCard
          title={t('monitor.network.uploadRate')}
          value={metrics.currentUploadRate}
          color="#3b82f6"
          icon={<ArrowUp size={20} />}
        />
        <NetworkStatCard
          title={t('monitor.network.downloadRate')}
          value={metrics.currentDownloadRate}
          color="#10b981"
          icon={<ArrowDown size={20} />}
        />
      </Grid>

      {/* 网络流量趋势图 - 使用 ECharts setOption 增量更新 */}
      <Card mb="4">
        <Text as="div" size="4" weight="bold" mb="4">
          {t('monitor.network.trafficTrend')}
        </Text>
        <NetworkChart data={chartData} height={300} />
      </Card>

      {/* 网络连接统计 */}
      <Card>
        <Flex align="center" gap="2" mb="4">
          <Network size={20} />
          <Text size="4" weight="bold">{t('monitor.network.connections')}</Text>
        </Flex>
        <Grid columns="4" gap="4">
          <ConnectionStatCard
            label="ESTABLISHED"
            value={networkConnections.established}
            color="#10b981"
          />
          <ConnectionStatCard
            label="CLOSED"
            value={networkConnections.closed}
            color="#6b7280"
          />
          <ConnectionStatCard
            label="ORPHANED"
            value={networkConnections.orphaned}
            color="#ef4444"
          />
          <ConnectionStatCard
            label="TIME_WAIT"
            value={networkConnections.timeWait}
            color="#f59e0b"
          />
        </Grid>
      </Card>
    </div>
  );
}

// 网络速率卡片
interface NetworkStatCardProps {
  title: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

function NetworkStatCard({ title, value, color, icon }: NetworkStatCardProps) {
  return (
    <Card>
      <Flex align="center" gap="3">
        <Box
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: `${color}15`,
            color,
          }}
        >
          {icon}
        </Box>
        <div>
          <Text size="2" color="gray">{title}</Text>
          <Text as="div" size="6" weight="bold" style={{ color }}>
            {formatBandwidth(value)}
          </Text>
        </div>
      </Flex>
    </Card>
  );
}

// 连接统计卡片
interface ConnectionStatCardProps {
  label: string;
  value: number;
  color: string;
}

function ConnectionStatCard({ label, value, color }: ConnectionStatCardProps) {
  return (
    <Box
      style={{
        padding: 16,
        borderRadius: 8,
        backgroundColor: `${color}10`,
        border: `1px solid ${color}30`,
      }}
    >
      <Flex direction="column" align="center" gap="1">
        <Text size="2" color="gray">{label}</Text>
        <Text size="6" weight="bold" style={{ color }}>
          {value}
        </Text>
      </Flex>
    </Box>
  );
}
