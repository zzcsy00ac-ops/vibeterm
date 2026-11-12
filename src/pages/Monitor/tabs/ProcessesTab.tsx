/**
 * Processes Tab - 进程排行
 */

import { useMemo } from 'react';
import { Card, Tabs, Text, Table, Flex, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useMonitorStore } from '../../../store/monitorStore';

interface ProcessesTabProps {
  sessionId: string;
}

export function ProcessesTab({ sessionId: _sessionId }: ProcessesTabProps) {
  const { t } = useTranslation();
  const { processes } = useMonitorStore();

  // 按内存排序的 Top 10
  const memoryTop10 = useMemo(() => {
    return [...processes]
      .sort((a, b) => b.memoryPercent - a.memoryPercent)
      .slice(0, 10);
  }, [processes]);

  // 按 CPU 排序的 Top 10
  const cpuTop10 = useMemo(() => {
    return [...processes]
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 10);
  }, [processes]);

  return (
    <div className="tab-content">
      <Tabs.Root defaultValue="memory">
        <Tabs.List>
          <Tabs.Trigger value="memory">{t('monitor.processes.memoryRanking')}</Tabs.Trigger>
          <Tabs.Trigger value="cpu">{t('monitor.processes.cpuRanking')}</Tabs.Trigger>
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="memory">
            <ProcessRanking
              title={t('monitor.processes.top10Memory')}
              data={memoryTop10}
              valueKey="memoryPercent"
              color="#8b5cf6"
            />
          </Tabs.Content>

          <Tabs.Content value="cpu">
            <ProcessRanking
              title={t('monitor.processes.top10Cpu')}
              data={cpuTop10}
              valueKey="cpuPercent"
              color="#f59e0b"
            />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </div>
  );
}

interface ProcessRankingProps {
  title: string;
  data: Array<{
    pid: number;
    name: string;
    user: string;
    cpuPercent: number;
    memoryPercent: number;
    memoryMB: number;
  }>;
  valueKey: 'cpuPercent' | 'memoryPercent';
  color: string;
}

function ProcessRanking({ title, data, valueKey, color }: ProcessRankingProps) {
  const { t } = useTranslation();

  // 为图表准备数据
  const chartData = useMemo(() => {
    return data.map((p, idx) => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
      value: p[valueKey],
      fullName: p.name,
      rank: idx + 1,
    }));
  }, [data, valueKey]);

  if (data.length === 0) {
    return (
      <Card>
        <Flex align="center" justify="center" style={{ height: 200 }}>
          <Text color="gray">{t('monitor.placeholder.processes')}</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <div>
      {/* 图表 */}
      <Card mb="4">
        <Text as="div" size="4" weight="bold" mb="4">{title}</Text>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-panel)',
                border: '1px solid var(--gray-6)',
                borderRadius: 8,
                color: 'var(--gray-12)',
              }}
              itemStyle={{
                color: 'var(--gray-12)',
              }}
              labelStyle={{
                color: 'var(--gray-12)',
              }}
              formatter={(value) => [
                `${(value as number).toFixed(2)}%`,
                t('monitor.processes.usage'),
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return (payload[0].payload as { fullName: string }).fullName;
                }
                return label;
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={color}
                  fillOpacity={0.8 - index * 0.05}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 表格 */}
      <Card>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell width="60px">{t('monitor.processes.rank')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t('monitor.processes.name')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="80px">{t('monitor.processes.pid')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="100px">{t('monitor.processes.user')}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="100px" align="right">{t('monitor.processes.usage')}</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((process, index) => (
              <Table.Row key={process.pid}>
                <Table.Cell>
                  <Text
                    size="2"
                    weight="bold"
                    style={{
                      color: index < 3 ? color : 'var(--gray-11)',
                    }}
                  >
                    #{index + 1}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" style={{ wordBreak: 'break-all' }}>
                    {process.name}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">{process.pid}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">{process.user}</Text>
                </Table.Cell>
                <Table.Cell align="right">
                  <Text
                    size="2"
                    weight="medium"
                    style={{
                      color: process[valueKey] > 50 ? 'var(--color-danger)' :
                             process[valueKey] > 20 ? 'var(--color-warning)' : 'var(--gray-11)',
                    }}
                  >
                    {process[valueKey].toFixed(1)}%
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </div>
  );
}
