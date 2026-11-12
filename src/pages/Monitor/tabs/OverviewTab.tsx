/**
 * Overview Tab - 服务器概览
 */

import { useMemo } from 'react';
import { Card, Grid, Text, Flex, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { Clock, HardDrive, Cpu, ArrowUp, ArrowDown } from 'lucide-react';
import { useMonitorStore } from '../../../store/monitorStore';
import { NetworkChart } from '../../../components/charts/NetworkChart';
import {
  formatUptime,
  formatBytes,
  formatBandwidth,
  getColorForPercentage,
  getDiskColor,
} from '../../../hooks/useMonitorData';

interface OverviewTabProps {
  sessionId: string;
}

export function OverviewTab({ sessionId: _sessionId }: OverviewTabProps) {
  const { t } = useTranslation();
  const { metrics, history } = useMonitorStore();

  // 计算内存剩余可用率（用于进度条显示）
  const memoryAvailablePercent = useMemo(() => {
    if (metrics.totalMemory === 0) return 0;
    return ((metrics.totalMemory - metrics.usedMemory) / metrics.totalMemory) * 100;
  }, [metrics.usedMemory, metrics.totalMemory]);

  // 计算系统负载百分比
  const loadPercent = useMemo(() => {
    return (metrics.loadAverage / metrics.cpuCores) * 100;
  }, [metrics.loadAverage, metrics.cpuCores]);

  // 计算磁盘使用率（用于颜色判断）和剩余可用率（用于进度条显示）
  const { usedPercent: diskUsedPercent, availablePercent: diskAvailablePercent } = useMemo(() => {
    if (metrics.totalDisk === 0) return { usedPercent: 0, availablePercent: 0 };
    const usedPercent = (metrics.usedDisk / metrics.totalDisk) * 100;
    return { usedPercent, availablePercent:  usedPercent };
  }, [metrics.usedDisk, metrics.totalDisk]);

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
      {/* 关键指标卡片 */}
      <Grid columns="4" gap="4" className="metric-grid">
        <MetricCard
          label={t('monitor.overview.uptime')}
          value={formatUptime(metrics.uptime)}
          icon={<Clock size={20} />}
          color="var(--color-cpu)"
        />
        <MetricCard
          label={t('monitor.overview.memory')}
          value={formatBytes(metrics.usedMemory)}
          subValue={`/ ${formatBytes(metrics.totalMemory)}`}
          percentage={100-memoryAvailablePercent}
          icon={<HardDrive size={20} />}
          color="var(--color-memory)"
          progressBarColor="var(--color-memory)"
        />
        <MetricCard
          label={t('monitor.overview.disk')}
          value={formatBytes(metrics.usedDisk)}
          subValue={`/ ${formatBytes(metrics.totalDisk)}`}
          percentage={diskAvailablePercent}
          icon={<HardDrive size={20} />}
          color={getDiskColor(diskUsedPercent)}
          progressBarColor={getDiskColor(diskUsedPercent)}
        />
        <MetricCard
          label={t('monitor.overview.load')}
          value={`${loadPercent.toFixed(1)}%`}
          // subValue={`Load: ${metrics.loadAverage.toFixed(2)} / ${metrics.cpuCores}`}
          percentage={loadPercent}
          icon={<Cpu size={20} />}
          color="var(--color-cpu)"
          progressBarColor="var(--color-cpu)"
        />
      </Grid>

      {/* 网络流量图表 - 使用 ECharts setOption 增量更新 */}
      <Card mt="4">
        <Text as="div" size="4" weight="bold" mb="4">
          {t('monitor.overview.networkTraffic')}
        </Text>
        <NetworkChart data={chartData} height={200} />
      </Card>

      {/* 实时带宽指示器 */}
      <Grid columns="2" gap="4" mt="4">
        <BandwidthCard
          type="upload"
          value={metrics.currentUploadRate}
          label={t('monitor.overview.currentUpload')}
        />
        <BandwidthCard
          type="download"
          value={metrics.currentDownloadRate}
          label={t('monitor.overview.currentDownload')}
        />
      </Grid>
    </div>
  );
}

// 指标卡片组件
interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  percentage?: number;
  icon: React.ReactNode;
  color: string;
  progressBarColor?: string; // 可选：进度条颜色（如果不提供，使用 percentage 自动计算）
}

function MetricCard({ label, value, subValue, percentage, icon, color, progressBarColor }: MetricCardProps) {
  // 确定进度条颜色
  const progressColor = progressBarColor !== undefined
    ? progressBarColor
    : getColorForPercentage(percentage ?? 0);
  return (
    <Card className="metric-card">
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Box style={{ color }}>{icon}</Box>
          <Text size="2" color="gray">{label}</Text>
        </Flex>
        <Flex align="baseline" gap="1">
          <Text size="6" weight="bold">{value}</Text>
          {subValue && (
            <Text size="2" color="gray">{subValue}</Text>
          )}
        </Flex>
        {percentage !== undefined && (
          <Flex align="center" gap="2">
            <Box style={{ flex: 1 }}>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, percentage)}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </Box>
            <Text size="1" color="gray">{percentage.toFixed(0)}%</Text>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

// 带宽指示器卡片
interface BandwidthCardProps {
  type: 'upload' | 'download';
  value: number;
  label: string;
}

function BandwidthCard({ type, value, label }: BandwidthCardProps) {
  const color = type === 'upload' ? '#3b82f6' : '#10b981';
  const Icon = type === 'upload' ? ArrowUp : ArrowDown;

  return (
    <Card>
      <Flex align="center" gap="3">
        <Box
          style={{
            padding: 8,
            borderRadius: 8,
            backgroundColor: `${color}20`,
            color,
          }}
        >
          <Icon size={20} />
        </Box>
        <div>
          <Text size="2" color="gray">{label}</Text>
          <Text as="div" size="5" weight="bold" style={{ color }}>
            {formatBandwidth(value)}
          </Text>
        </div>
      </Flex>
    </Card>
  );
}
