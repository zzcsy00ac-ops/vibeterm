/**
 * 监控数据 Store
 *
 * 用于 Monitor 窗口内的状态管理
 * 注意：每个 Monitor 窗口有独立的 store 实例
 */

import { create } from 'zustand';
import type {
  MonitorData,
  MonitorStatus,
  ServerMetrics,
  NetworkHistoryPoint,
  ProcessInfo,
  DiskUsage,
  NetworkConnections,
} from '../types/monitor';
import {
  DEFAULT_METRICS,
  DEFAULT_NETWORK_CONNECTIONS,
} from '../types/monitor';

/** 历史数据最大保留数量（5分钟 * 60秒/5秒间隔 = 60条） */
const MAX_HISTORY_LENGTH = 60;

interface MonitorState {
  /** 会话 ID */
  sessionId: string | null;
  /** 连接信息 */
  connectionInfo: {
    host: string;
    port: number;
    username: string;
  } | null;
  /** 监控状态 */
  status: MonitorStatus;
  /** 错误信息 */
  error: string | null;
  /** 基础指标 */
  metrics: ServerMetrics;
  /** 网络历史数据 */
  history: NetworkHistoryPoint[];
  /** 进程列表 */
  processes: ProcessInfo[];
  /** 磁盘使用情况 */
  diskUsage: DiskUsage[];
  /** 网络连接统计 */
  networkConnections: NetworkConnections;
  /** 最后更新时间 */
  lastUpdated: number;
  /** 是否正在监控 */
  isMonitoring: boolean;

  // Actions
  /** 初始化监控 */
  initialize: (sessionId: string, host: string, port: number, username: string) => void;
  /** 设置状态 */
  setStatus: (status: MonitorStatus) => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 更新基础指标 */
  updateMetrics: (metrics: ServerMetrics) => void;
  /** 添加网络历史数据点 */
  addHistoryPoint: (point: NetworkHistoryPoint) => void;
  /** 更新进程列表 */
  updateProcesses: (processes: ProcessInfo[]) => void;
  /** 更新磁盘使用情况 */
  updateDiskUsage: (diskUsage: DiskUsage[]) => void;
  /** 更新网络连接统计 */
  updateNetworkConnections: (connections: NetworkConnections) => void;
  /** 更新完整数据 */
  updateAll: (data: Partial<MonitorData>) => void;
  /** 开始监控 */
  startMonitoring: () => void;
  /** 停止监控 */
  stopMonitoring: () => void;
  /** 重置状态 */
  reset: () => void;
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  // 初始状态
  sessionId: null,
  connectionInfo: null,
  status: 'idle',
  error: null,
  metrics: DEFAULT_METRICS,
  history: [],
  processes: [],
  diskUsage: [],
  networkConnections: DEFAULT_NETWORK_CONNECTIONS,
  lastUpdated: 0,
  isMonitoring: false,

  // Actions
  initialize: (sessionId, host, port, username) => {
    set({
      sessionId,
      connectionInfo: { host, port, username },
      status: 'loading',
      error: null,
    });
  },

  setStatus: (status) => {
    set({ status });
  },

  setError: (error) => {
    set({ error, status: error ? 'error' : get().status });
  },

  updateMetrics: (metrics) => {
    const now = Date.now();
    const currentMetrics = get().metrics;

    // 创建新的历史数据点
    const newPoint: NetworkHistoryPoint = {
      time: now,
      uploadRate: metrics.currentUploadRate,
      downloadRate: metrics.currentDownloadRate,
    };

    set((state) => ({
      metrics,
      lastUpdated: now,
      // 只有当速率变化时才添加历史数据
      history: metrics.currentUploadRate !== currentMetrics.currentUploadRate ||
               metrics.currentDownloadRate !== currentMetrics.currentDownloadRate
        ? [...state.history.slice(-MAX_HISTORY_LENGTH + 1), newPoint]
        : state.history,
    }));
  },

  addHistoryPoint: (point) => {
    set((state) => ({
      history: [...state.history.slice(-MAX_HISTORY_LENGTH + 1), point],
    }));
  },

  updateProcesses: (processes) => {
    set({ processes, lastUpdated: Date.now() });
  },

  updateDiskUsage: (diskUsage) => {
    set({ diskUsage, lastUpdated: Date.now() });
  },

  updateNetworkConnections: (connections) => {
    set({ networkConnections: connections, lastUpdated: Date.now() });
  },

  updateAll: (data) => {
    const now = Date.now();
    const updates: Partial<MonitorState> = {};

    // 基准检查：内存必须有效（内存总是 > 0，所以可以用来判断是否整体成功）
    const isBaselineValid = data.metrics && data.metrics.totalMemory > 0;

    if (isBaselineValid) {
      const m = data.metrics!;
      const currentMetrics = get().metrics;

      // 构建新的 metrics 对象，只包含有效的字段
      const validMetrics: ServerMetrics = { ...currentMetrics };

      // 逐个检查并更新字段（只更新有真实数据的字段，避免用失败值覆盖）
      let hasMetricsUpdate = false;

      if (m.uptime > 0) {
        validMetrics.uptime = m.uptime;
        hasMetricsUpdate = true;
      }
      if (m.totalMemory > 0) {
        validMetrics.totalMemory = m.totalMemory;
        hasMetricsUpdate = true;
      }
      if (m.usedMemory > 0) {
        validMetrics.usedMemory = m.usedMemory;
        hasMetricsUpdate = true;
      }
      if (m.freeMemory >= 0) {  // freeMemory 可能真的是 0
        validMetrics.freeMemory = m.freeMemory;
        hasMetricsUpdate = true;
      }
      if (m.totalDisk > 0) {
        validMetrics.totalDisk = m.totalDisk;
        hasMetricsUpdate = true;
      }
      if (m.usedDisk > 0) {
        validMetrics.usedDisk = m.usedDisk;
        hasMetricsUpdate = true;
      }
      if (m.freeDisk >= 0) {
        validMetrics.freeDisk = m.freeDisk;
        hasMetricsUpdate = true;
      }
      if (m.loadAverage >= 0) {  // loadAverage 可能真的是 0
        validMetrics.loadAverage = m.loadAverage;
        hasMetricsUpdate = true;
      }

      // 网络字节数：必须 > 0 才有效（0 表示命令失败）
      if (m.rxBytes > 0 && m.txBytes > 0) {
        validMetrics.rxBytes = m.rxBytes;
        validMetrics.txBytes = m.txBytes;
        validMetrics.currentUploadRate = m.currentUploadRate;
        validMetrics.currentDownloadRate = m.currentDownloadRate;
        hasMetricsUpdate = true;

        // 添加网络历史数据点
        const newPoint: NetworkHistoryPoint = {
          time: now,
          uploadRate: m.currentUploadRate,
          downloadRate: m.currentDownloadRate,
        };
        const currentHistory = get().history;
        updates.history = [...currentHistory.slice(-MAX_HISTORY_LENGTH + 1), newPoint];
      }

      if (hasMetricsUpdate) {
        updates.metrics = validMetrics;
        updates.lastUpdated = now;
      }
    }

    // 只更新有效的进程列表（有数据且不为空）
    if (data.processes && data.processes.length > 0) {
      updates.processes = data.processes;
      updates.lastUpdated = now;
    }

    // 只更新有效的磁盘使用数据（有数据且不为空）
    if (data.diskUsage && data.diskUsage.length > 0) {
      updates.diskUsage = data.diskUsage;
      updates.lastUpdated = now;
    }

    // 网络连接统计：检查是否有效（不是默认的全 0 值）
    if (data.networkConnections) {
      const { established, closed, orphaned, timeWait } = data.networkConnections;
      // 至少有一个非 0 值才更新
      if (established > 0 || closed > 0 || orphaned > 0 || timeWait > 0) {
        updates.networkConnections = data.networkConnections;
        updates.lastUpdated = now;
      }
    }

    // 只有当有有效数据更新时才更新
    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  startMonitoring: () => {
    set({ isMonitoring: true, status: 'connected' });
  },

  stopMonitoring: () => {
    set({ isMonitoring: false, status: 'idle' });
  },

  reset: () => {
    set({
      sessionId: null,
      connectionInfo: null,
      status: 'idle',
      error: null,
      metrics: DEFAULT_METRICS,
      history: [],
      processes: [],
      diskUsage: [],
      networkConnections: DEFAULT_NETWORK_CONNECTIONS,
      lastUpdated: 0,
      isMonitoring: false,
    });
  },
}));
