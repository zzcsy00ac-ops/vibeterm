/**
 * Token 数字格式化工具
 *
 * 将大数字格式化为易读的缩写形式（K/M/B）
 * 使用模块级缓存提升性能
 */

// ✅ 模块级缓存（js-cache-function-results）
const formatCache = new Map<number, string>();

// 缓存大小限制，避免内存泄漏
const MAX_CACHE_SIZE = 1000;

/**
 * 格式化 Token 数量显示
 *
 * @param count - 要格式化的数字
 * @returns 格式化后的字符串
 *
 * @example
 * formatTokenCount(123)      // "123"
 * formatTokenCount(1234)     // "1.2K"
 * formatTokenCount(1234567)  // "1.5M"
 * formatTokenCount(1234567890) // "1.2B"
 */
export function formatTokenCount(count: number): string {
  // 检查缓存
  if (formatCache.has(count)) {
    return formatCache.get(count)!;
  }

  let result: string;
  if (count < 0) {
    result = '0';
  } else if (count < 1000) {
    result = count.toString();
  } else if (count < 1000000) {
    result = `${(count / 1000).toFixed(1)}K`;
  } else if (count < 1000000000) {
    result = `${(count / 1000000).toFixed(1)}M`;
  } else {
    result = `${(count / 1000000000).toFixed(1)}B`;
  }

  // 缓存结果（限制缓存大小以避免内存泄漏）
  if (formatCache.size < MAX_CACHE_SIZE) {
    formatCache.set(count, result);
  } else if (formatCache.size >= MAX_CACHE_SIZE) {
    // 缓存满了，清空重新开始
    formatCache.clear();
    formatCache.set(count, result);
  }

  return result;
}

/**
 * 清空格式化缓存
 *
 * 在需要释放内存时调用
 */
export function clearFormatCache(): void {
  formatCache.clear();
}
