/**
 * 函数工具集合
 *
 * 提供常用的工具函数，如延迟、防抖、节流等
 */

/**
 * 延迟指定的时间
 *
 * @param ms - 延迟的毫秒数
 * @returns Promise，在指定时间后 resolve
 *
 * @example
 * ```typescript
 * await delay(100); // 延迟 100ms
 * console.log('100ms 后执行');
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 延迟指定的时间并返回值
 *
 * @param ms - 延迟的毫秒数
 * @param value - 延迟后返回的值
 * @returns Promise，在指定时间后 resolve 并返回给定值
 *
 * @example
 * ```typescript
 * const result = await delayWithValue(100, 'hello');
 * console.log(result); // 100ms 后输出 'hello'
 * ```
 */
export function delayWithValue<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
