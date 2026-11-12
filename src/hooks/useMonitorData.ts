/**
 * 监控数据获取 Hook
 *
 * 负责从 Rust 后端获取监控数据并更新 Store
 * 前端计算网络速率（通过两次采样差值）
 */

import { useEffect, useRef, useCallback } from 'react';
import { getMonitorData } from '../command';
import { useMonitorStore } from '../store/monitorStore';
import type { MonitorData, ServerMetrics } from '../types/monitor';
import type { MonitorConnectConfig } from '../command';

/** 数据刷新间隔（毫秒） */
const REFRESH_INTERVAL = 5000;

interface UseMonitorDataOptions {
  /** SSH 会话 ID */
  sessionId: string;
  /** 主机地址 */
  host: string;
  /** 端口 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码（可选，如果使用私钥认证则不需要） */
  password?: string;
  /** 私钥文件路径（可选，如果使用密码认证则不需要） */
  privateKeyPath?: string;
  /** 密钥密码短语（可选） */
  keyPassphrase?: string;
  /** 是否自动开始监控 */
  autoStart?: boolean;
  /** 刷新间隔（毫秒） */
  refreshInterval?: number;
}

interface UseMonitorDataReturn {
  /** 开始监控 */
  start: () => void;
  /** 停止监控 */
  stop: () => void;
  /** 手动刷新 */
  refresh: () => Promise<void>;
  /** 是否正在监控 */
  isMonitoring: boolean;
}

/**
 * 监控数据获取 Hook
 */
export function useMonitorData({
  sessionId,
  host,
  port,
  username,
  password,
  privateKeyPath,
  keyPassphrase,
  autoStart = true,
  refreshInterval = REFRESH_INTERVAL,
}: UseMonitorDataOptions): UseMonitorDataReturn {
  const {
    initialize,
    setStatus,
    setError,
    updateAll,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  } = useMonitorStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // 保存上次网络数据，用于计算速率
  const lastNetworkDataRef = useRef<{
    rxBytes: number;
    txBytes: number;
    timestamp: number;
    uploadRate: number;
    downloadRate: number;
  } | null>(null);

  // 最大合理差值：5秒内不超过 10GB（处理 0 值或计数器回滚）
  const MAX_REASONABLE_DELTA = 10_000_000_000;

  // 计算网络速率
  const calculateNetworkRates = useCallback((
    currentRxBytes: number,
    currentTxBytes: number,
    currentTimestamp: number
  ): { uploadRate: number; downloadRate: number } => {
    const lastData = lastNetworkDataRef.current;

    // 首次采样：保存数据，返回 0 速率
    if (!lastData) {
      if (currentRxBytes > 0 && currentTxBytes > 0) {
        lastNetworkDataRef.current = {
          rxBytes: currentRxBytes,
          txBytes: currentTxBytes,
          timestamp: currentTimestamp,
          uploadRate: 0,
          downloadRate: 0,
        };
      }
      return { uploadRate: 0, downloadRate: 0 };
    }

    // 验证当前值有效（SSH 命令失败时返回 0）
    if (currentRxBytes <= 0 || currentTxBytes <= 0) {
      return { uploadRate: lastData.uploadRate, downloadRate: lastData.downloadRate };
    }

    // 计算时间差（秒）
    const timeDiff = (currentTimestamp - lastData.timestamp) / 1000;

    // 验证时间差合理（0.5s ~ 60s）
    if (timeDiff < 0.5 || timeDiff > 60) {
      return { uploadRate: lastData.uploadRate, downloadRate: lastData.downloadRate };
    }

    // 计算字节数差值
    const rxDiff = currentRxBytes - lastData.rxBytes;
    const txDiff = currentTxBytes - lastData.txBytes;

    // 验证差值合理（检测异常大差值，避免 0 值恢复或计数器回滚）
    if (rxDiff < 0 || rxDiff > MAX_REASONABLE_DELTA || txDiff < 0 || txDiff > MAX_REASONABLE_DELTA) {
      return { uploadRate: lastData.uploadRate, downloadRate: lastData.downloadRate };
    }

    // 计算速率（字节/秒）
    const uploadRate = txDiff / timeDiff;
    const downloadRate = rxDiff / timeDiff;

    // 更新缓存
    lastNetworkDataRef.current = {
      rxBytes: currentRxBytes,
      txBytes: currentTxBytes,
      timestamp: currentTimestamp,
      uploadRate,
      downloadRate,
    };

    return { uploadRate, downloadRate };
  }, []);

  // 获取监控数据
  const fetchMonitorData = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const config: MonitorConnectConfig = {
        sessionId,
        host,
        port,
        username,
        ...(password && { password }),
        ...(privateKeyPath && { privateKeyPath }),
        ...(keyPassphrase && { keyPassphrase }),
      };

      const data = await getMonitorData(config) as MonitorData;

      if (!isMountedRef.current) return;

      // 计算网络速率
      const now = Date.now();
      const { uploadRate, downloadRate } = calculateNetworkRates(
        data.metrics.rxBytes,
        data.metrics.txBytes,
        now
      );

      // 获取当前 store 中的 metrics（用于保留有效数据）
      const currentMetrics = useMonitorStore.getState().metrics;

      // 验证数据完整性（字段组必须都有效才更新）
      const isDiskDataValid = data.metrics.totalDisk > 0 &&
                              data.metrics.usedDisk > 0 &&
                              data.metrics.freeDisk >= 0;

      const isMemoryDataValid = data.metrics.totalMemory > 0 &&
                               data.metrics.usedMemory > 0 &&
                               data.metrics.freeMemory >= 0;

      // 构建更新的 metrics，只更新有效的数据组
      const updatedMetrics: ServerMetrics = {
        ...currentMetrics, // 默认保留当前值

        // uptime：单独检查
        uptime: data.metrics.uptime > 0 ? data.metrics.uptime : currentMetrics.uptime,

        // 内存：三个字段都有效时才一起更新
        ...(isMemoryDataValid ? {
          totalMemory: data.metrics.totalMemory,
          usedMemory: data.metrics.usedMemory,
          freeMemory: data.metrics.freeMemory,
        } : {}),

        // 磁盘：三个字段都有效时才一起更新
        ...(isDiskDataValid ? {
          totalDisk: data.metrics.totalDisk,
          usedDisk: data.metrics.usedDisk,
          freeDisk: data.metrics.freeDisk,
        } : {}),

        // loadAverage：可以为 0（空闲系统）
        loadAverage: data.metrics.loadAverage >= 0 ? data.metrics.loadAverage : currentMetrics.loadAverage,

        // 网络字节数：必须都 > 0
        ...(data.metrics.rxBytes > 0 && data.metrics.txBytes > 0 ? {
          rxBytes: data.metrics.rxBytes,
          txBytes: data.metrics.txBytes,
        } : {}),

        // 网络速率：总是更新（前端计算的）
        currentUploadRate: uploadRate,
        currentDownloadRate: downloadRate,
      };

      // 更新 store
      updateAll({
        processes: data.processes,
        diskUsage: data.diskUsage,
        networkConnections: data.networkConnections,
        metrics: updatedMetrics,
        lastUpdated: Date.now(),
      });
      setError(null);
    } catch (error) {
      if (!isMountedRef.current) return;

      console.error('[useMonitorData] Failed to fetch monitor data:', error);
      setError(error instanceof Error ? error.message : String(error));

      // 发生错误时重置网络数据
      lastNetworkDataRef.current = null;
    }
  }, [sessionId, host, port, username, password, privateKeyPath, keyPassphrase, updateAll, setError, calculateNetworkRates]);

  // 开始监控
  const start = useCallback(() => {
    if (intervalRef.current) return;

    setStatus('loading');
    startMonitoring();

    // 重置网络数据
    lastNetworkDataRef.current = null;

    // 立即获取一次数据
    fetchMonitorData().then(() => {
      if (isMountedRef.current) {
        setStatus('connected');
      }
    });

    // 设置定时刷新
    intervalRef.current = setInterval(fetchMonitorData, refreshInterval);
  }, [fetchMonitorData, refreshInterval, setStatus, startMonitoring]);

  // 停止监控
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopMonitoring();

    // 重置网络数据
    lastNetworkDataRef.current = null;
  }, [stopMonitoring]);

  // 手动刷新
  const refresh = useCallback(async () => {
    await fetchMonitorData();
  }, [fetchMonitorData]);

  // 初始化
  useEffect(() => {
    isMountedRef.current = true;
    initialize(sessionId, host, port, username);

    if (autoStart) {
      start();
    }

    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [sessionId, host, port, username, autoStart, initialize, start, stop]);

  return {
    start,
    stop,
    refresh,
    isMonitoring,
  };
}

/**
 * 格式化运行时长
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化带宽速率
 */
export function formatBandwidth(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';

  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 根据百分比获取状态颜色
 */
export function getColorForPercentage(percent: number): string {
  if (percent < 50) return 'var(--color-healthy, #10b981)';
  if (percent < 80) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-danger, #ef4444)';
}

/**
 * 获取磁盘使用颜色
 */
export function getDiskColor(percent: number): string {
  return getColorForPercentage(percent);
}
