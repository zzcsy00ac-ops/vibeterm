/**
 * mermaidCache - Mermaid 渲染结果 LRU 缓存
 *
 * 使用 LRU（Least Recently Used）策略缓存已渲染的 SVG。
 * 限制缓存大小避免内存占用过高，自动清理过期条目。
 */

/**
 * 缓存条目
 */
interface CacheEntry {
  /** SVG 字符串 */
  svg: string;
  /** 创建时间戳（毫秒） */
  timestamp: number;
}

// ==================== 配置 ====================

/** 最大缓存条目数 */
const MAX_CACHE_SIZE = 50;

/** 缓存过期时间（1 小时） */
const CACHE_TTL = 1000 * 60 * 60;

/** 清理间隔（5 分钟） */
const CLEANUP_INTERVAL = 1000 * 60 * 5;

// ==================== 缓存存储 ====================

/**
 * LRU 缓存 Map
 *
 * Map 保持插入顺序，便于实现 LRU 淘汰：
 * - 最旧的条目在开头
 * - 最新的条目在末尾
 */
const cache = new Map<string, CacheEntry>();

// ==================== 辅助函数 ====================

/**
 * 生成缓存键
 *
 * 使用 Mermaid 代码本身作为键（已经足够唯一）。
 * 如果需要更短的键，可以使用哈希算法（如 crypto.subtle.digest）。
 *
 * @param code - Mermaid 图表代码
 * @returns 缓存键
 */
function generateCacheKey(code: string): string {
  return code;
}

/**
 * LRU 淘汰：移除最旧的条目
 *
 * 当缓存达到上限时，删除最旧的条目（Map 的第一个元素）。
 */
function evictLRU(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
}

/**
 * 将条目移到末尾（标记为最近使用）
 *
 * @param key - 缓存键
 */
function moveToTail(key: string): void {
  const entry = cache.get(key);
  if (entry) {
    cache.delete(key);
    cache.set(key, entry);
  }
}

// ==================== 公共 API ====================

/**
 * 获取缓存的 Mermaid SVG
 *
 * @param code - Mermaid 图表代码
 * @returns SVG 字符串，如果缓存未命中或已过期则返回 null
 */
export function getCachedMermaid(code: string): string | null {
  const key = generateCacheKey(code);
  const entry = cache.get(key);

  // 缓存未命中
  if (!entry) {
    return null;
  }

  // 检查是否过期
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  // LRU: 移到末尾（标记为最近使用）
  moveToTail(key);

  return entry.svg;
}

/**
 * 缓存 Mermaid 渲染结果
 *
 * @param code - Mermaid 图表代码
 * @param svg - 渲染后的 SVG 字符串
 */
export function setCachedMermaid(code: string, svg: string): void {
  // 先执行 LRU 淘汰
  evictLRU();

  const key = generateCacheKey(code);
  cache.set(key, {
    svg,
    timestamp: Date.now(),
  });
}

/**
 * 清空所有缓存
 *
 * 主要用于主题切换场景，因为 SVG 样式依赖主题。
 */
export function clearMermaidCache(): void {
  cache.clear();
}

/**
 * 获取缓存统计信息（用于调试）
 *
 * @returns 缓存统计
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  entries: Array<{ keyLength: number; timestamp: number }>;
} {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      keyLength: key.length,
      timestamp: entry.timestamp,
    })),
  };
}

// ==================== 定期清理 ====================

/**
 * 清理过期缓存
 *
 * 定期执行，删除所有超过 TTL 的条目。
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0 && import.meta.env.DEV) {
    console.log(`[MermaidCache] 清理了 ${cleanedCount} 个过期条目`);
  }
}

// 启动定期清理定时器
const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

// 开发环境：在页面卸载时清理定时器
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearInterval(cleanupTimer);
  });
}

// 导出定时器 ID（用于测试）
export { cleanupTimer };
