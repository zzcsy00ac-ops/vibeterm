/**
 * Disk Tab - 磁盘详情
 */

import { Card, Text, Flex, Box, Grid } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { HardDrive } from 'lucide-react';
import { useMonitorStore } from '../../../store/monitorStore';
import { getDiskColor, formatBytes } from '../../../hooks/useMonitorData';

interface DiskTabProps {
  sessionId: string;
}

export function DiskTab({ sessionId: _sessionId }: DiskTabProps) {
  const { t } = useTranslation();
  const { diskUsage } = useMonitorStore();

  if (diskUsage.length === 0) {
    return (
      <div className="tab-content">
        <Card>
          <Flex align="center" justify="center" style={{ height: 200 }}>
            <Text color="gray">{t('monitor.placeholder.disk')}</Text>
          </Flex>
        </Card>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <Grid columns="1" gap="4">
        {diskUsage.map((disk) => (
          <DiskCard key={disk.mountPoint} disk={disk} />
        ))}
      </Grid>
    </div>
  );
}

interface DiskCardProps {
  disk: {
    mountPoint: string;
    filesystem: string;
    type: string;
    total: string;
    used: string;
    free: string;
    percent: number;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
  };
}

function DiskCard({ disk }: DiskCardProps) {
  const { t } = useTranslation();
  const color = getDiskColor(disk.percent);
  const availablePercent = 100 - disk.percent;

  const pieData = [
    { name: t('monitor.disk.available'), value: disk.freeBytes },
    { name: t('monitor.disk.used'), value: disk.usedBytes },
  ];

  return (
    <Card>
      <Flex gap="6">
        {/* 左侧信息 */}
        <Box style={{ flex: 1 }}>
          <Flex align="center" gap="2" mb="4">
            <HardDrive size={20} style={{ color }} />
            <Text size="5" weight="bold">{disk.mountPoint}</Text>
          </Flex>

          {/* 进度条 */}
          <Box mb="4">
            <Flex justify="between" mb="2">
              <Text size="2" color="gray">
                {t('monitor.disk.used')}: {disk.used}
              </Text>
              <Text size="2" weight="bold" style={{ color }}>
                {availablePercent.toFixed(1)}%
              </Text>
            </Flex>
            <div className="disk-progress-bar">
              <div
                className="disk-progress-fill"
                style={{
                  width: `${availablePercent}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </Box>

          {/* 详细信息 */}
          <Grid columns="2" gap="3">
            <InfoItem label={t('monitor.disk.filesystem')} value={disk.filesystem} />
            <InfoItem label={t('monitor.disk.type')} value={disk.type || '-'} />
            <InfoItem
              label={`${t('monitor.disk.used')} / Total`}
              value={`${disk.used} / ${disk.total}`}
            />
            <InfoItem label={t('monitor.disk.available')} value={disk.free} />
          </Grid>
        </Box>

        {/* 右侧饼图 */}
        <Box style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill={color} />
                <Cell fill="var(--gray-6)" />
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 8,
                }}
                formatter={(value) => formatBytes(value as number)}
              />
            </PieChart>
          </ResponsiveContainer>
          <Flex justify="center" gap="4" mt="-2">
            <Flex align="center" gap="1">
              <Box
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: color,
                }}
              />
              <Text size="1" color="gray">{t('monitor.disk.available')}</Text>
            </Flex>
            <Flex align="center" gap="1">
              <Box
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: 'var(--gray-6)',
                }}
              />
              <Text size="1" color="gray">{t('monitor.disk.used')}</Text>
            </Flex>
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
}

// 信息项组件
interface InfoItemProps {
  label: string;
  value: string;
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <Box>
      <Text size="1" color="gray">{label}</Text>
      <Text as="div" size="2" weight="medium">{value}</Text>
    </Box>
  );
}
