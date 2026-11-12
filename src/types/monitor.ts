/**
 * 监控数据类型定义
 */

/**
 * 服务器基础指标
 */
export interface ServerMetrics {
  /** 运行时长（秒） */
  uptime: number;
  /** CPU 核心数 */
  cpuCores: number;
  /** 总内存（字节） */
  totalMemory: number;
  /** 已用内存（字节） */
  usedMemory: number;
  /** 剩余内存（字节） */
  freeMemory: number;
  /** 总磁盘（字节） */
  totalDisk: number;
  /** 已用磁盘（字节） */
  usedDisk: number;
  /** 剩余磁盘（字节） */
  freeDisk: number;
  /** 系统负载（1分钟平均） */
  loadAverage: number;
  /** 当前上传速率（字节/秒）- 由前端计算 */
  currentUploadRate: number;
  /** 当前下载速率（字节/秒）- 由前端计算 */
  currentDownloadRate: number;
  /** 累计接收字节数（用于前端计算速率） */
  rxBytes: number;
  /** 累计发送字节数（用于前端计算速率） */
  txBytes: number;
}

/**
 * 网络历史数据点
 */
export interface NetworkHistoryPoint {
  /** 时间戳 */
  time: number;
  /** 上传速率（字节/秒） */
  uploadRate: number;
  /** 下载速率（字节/秒） */
  downloadRate: number;
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  /** 进程 ID */
  pid: number;
  /** 进程名称 */
  name: string;
  /** 用户 */
  user: string;
  /** CPU 使用率（百分比） */
  cpuPercent: number;
  /** 内存使用率（百分比） */
  memoryPercent: number;
  /** 内存使用量（MB） */
  memoryMB: number;
}

/**
 * 磁盘使用信息
 */
export interface DiskUsage {
  /** 挂载点 */
  mountPoint: string;
  /** 文件系统 */
  filesystem: string;
  /** 类型 */
  type: string;
  /** 总容量（可读格式） */
  total: string;
  /** 已用容量（可读格式） */
  used: string;
  /** 剩余容量（可读格式） */
  free: string;
  /** 使用百分比 */
  percent: number;
  /** 总容量（字节） */
  totalBytes: number;
  /** 已用容量（字节） */
  usedBytes: number;
  /** 剩余容量（字节） */
  freeBytes: number;
}

/**
 * 网络连接统计
 */
export interface NetworkConnections {
  /** ESTABLISHED 连接数 */
  established: number;
  /** CLOSED 连接数 */
  closed: number;
  /** ORPHANED 连接数 */
  orphaned: number;
  /** TIME_WAIT 连接数 */
  timeWait: number;
}

/**
 * 完整监控数据
 */
export interface MonitorData {
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
}

/**
 * 监控状态
 */
export type MonitorStatus = 'idle' | 'loading' | 'connected' | 'error';

/**
 * 默认服务器指标
 */
export const DEFAULT_METRICS: ServerMetrics = {
  uptime: 0,
  cpuCores: 1,
  totalMemory: 0,
  usedMemory: 0,
  freeMemory: 0,
  totalDisk: 0,
  usedDisk: 0,
  freeDisk: 0,
  loadAverage: 0,
  currentUploadRate: 0,
  currentDownloadRate: 0,
  rxBytes: 0,
  txBytes: 0,
};

/**
 * 默认网络连接统计
 */
export const DEFAULT_NETWORK_CONNECTIONS: NetworkConnections = {
  established: 0,
  closed: 0,
  orphaned: 0,
  timeWait: 0,
};

/**
 * 默认监控数据
 */
export const DEFAULT_MONITOR_DATA: MonitorData = {
  metrics: DEFAULT_METRICS,
  history: [],
  processes: [],
  diskUsage: [],
  networkConnections: DEFAULT_NETWORK_CONNECTIONS,
  lastUpdated: 0,
};
