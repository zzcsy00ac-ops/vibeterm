/**
 * 网络流量折线图组件 - 使用 ECharts setOption 增量更新
 */

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { useTranslation } from 'react-i18next';

interface NetworkChartProps {
  /** 数据点数组，每个点包含 time, uploadRate, downloadRate */
  data: Array<{ time: number; uploadRate: number; downloadRate: number }>;
  /** 图表高度 */
  height?: number;
}

export function NetworkChart({ data, height = 200 }: NetworkChartProps) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: 'canvas',
    });

    chartInstanceRef.current = chart;

    // 初始配置
    chart.setOption({
      grid: { top: 10, right: 10, bottom: 20, left: 60 },
      xAxis: {
        type: 'category',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#999', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#999',
          fontSize: 11,
          formatter: (value: number) => value.toFixed(2) + ' MB/s',
        },
        splitLine: { lineStyle: { color: '#333' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#444',
        textStyle: { color: '#ddd' },
        formatter: (params: any) => {
          const upload = params[0]?.value || 0;
          const download = params[1]?.value || 0;
          return `
            ${t('monitor.overview.currentUpload')}: ${upload.toFixed(2)} MB/s<br/>
            ${t('monitor.overview.currentDownload')}: ${download.toFixed(2)} MB/s
          `;
        },
      },
    });

    // 响应窗口大小变化
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // 数据更新时使用 setOption 增量更新
  useEffect(() => {
    if (!chartInstanceRef.current) return;

    const chart = chartInstanceRef.current;

    // 格式化数据 (MB/s)
    const xAxisData = data.map((d) => new Date(d.time).toLocaleTimeString());
    const uploadData = data.map((d) => d.uploadRate / 1024 / 1024);
    const downloadData = data.map((d) => d.downloadRate / 1024 / 1024);

    // 使用 setOption 增量更新，只更新数据部分
    chart.setOption({
      xAxis: { data: xAxisData },
      series: [
        {
          name: t('monitor.overview.currentUpload'),
          type: 'line',
          data: uploadData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#3b82f6', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ]),
          },
        },
        {
          name: t('monitor.overview.currentDownload'),
          type: 'line',
          data: downloadData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#10b981', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0)' },
            ]),
          },
        },
      ],
    });
  }, [data, t]);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
}
