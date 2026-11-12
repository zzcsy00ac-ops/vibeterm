/**
 * Tauri IPC 调用超时包装器
 *
 * 为 Tauri 的 invoke 函数添加超时保护，防止因后端阻塞导致前端无限等待。
 *
 * @module invokeWithTimeout
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 超时错误类
 *
 * 当 Tauri 命令执行超过指定时间时抛出。
 */
export class InvokeTimeoutError extends Error {
  /**
   * 创建超时错误实例
   *
   * @param command - 超时的 Tauri 命令名称
   * @param timeout - 超时时间（毫秒）
   */
  constructor(
    public readonly command: string,
    public readonly timeout: number
  ) {
    super(`Tauri command "${command}" timed out after ${timeout}ms`);
    this.name = 'InvokeTimeoutError';
  }
}

/**
 * 带超时的 Tauri invoke 调用
 *
 * 使用 Promise.race 实现超时机制：如果 invoke 调用或超时定时器先完成，
 * 整个 Promise 就会以相应的结果 settled。
 *
 * @param command - Tauri 命令名称
 * @param args - 传递给命令的参数对象
 * @param timeout - 超时时间（毫秒），默认 60000（60 秒）
 * @returns Promise<T> - 命令执行结果
 * @throws {InvokeTimeoutError} - 超时时抛出
 *
 * @example
 * ```typescript
 * // 基本用法（使用默认 60 秒超时）
 * const result = await invokeWithTimeout('tool_execute_command', {
 *   sessionId: 'abc123',
 *   command: 'ls -la'
 * });
 *
 * // 自定义超时时间（30 秒）
 * const result = await invokeWithTimeout('tool_execute_command', {
 *   sessionId: 'abc123',
 *   command: 'sleep 100'
 * }, 30000);
 *
 * // 处理超时错误
 * try {
 *   const result = await invokeWithTimeout('my_command', { arg: 'value' }, 5000);
 *   console.log(result);
 * } catch (error) {
 *   if (error instanceof InvokeTimeoutError) {
 *     console.error(`Command "${error.command}" timed out after ${error.timeout}ms`);
 *     // 显示用户友好的错误提示
 *   }
 * }
 * ```
 */
export function invokeWithTimeout<T>(
  command: string,
  args: Record<string, unknown> = {},
  timeout: number = 60000
): Promise<T> {
  return Promise.race([
    // 实际的 invoke 调用
    invoke<T>(command, args),

    // 超时 Promise
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new InvokeTimeoutError(command, timeout));
      }, timeout)
    ),
  ]);
}

/**
 * 创建可取消的 invoke 调用
 *
 * 返回一个包含 cancel 方法的 Promise，允许主动取消操作。
 * 这对于需要在用户点击"取消"按钮时中止长时间运行的命令非常有用。
 *
 * 注意：此函数只能取消前端的等待状态，不能中止已在 Rust 后端执行的命令。
 * 要实现完整的取消功能，需要在 Rust 端配合实现取消令牌机制（阶段2）。
 *
 * @param command - Tauri 命令名称
 * @param args - 传递给命令的参数对象
 * @param timeout - 超时时间（毫秒），默认 60000（60 秒）
 * @returns 包含 promise 和 cancel 方法的对象
 *
 * @example
 * ```typescript
 * const { promise, cancel } = invokeWithCancel('tool_execute_command', {
 *   sessionId: 'abc123',
 *   command: 'long_running_task'
 * }, 120000); // 2 分钟超时
 *
 * // 用户点击取消按钮时
 * cancelButton.onClick(() => {
 *   cancel('User cancelled the operation');
 * });
 *
 * try {
 *   const result = await promise;
 *   console.log('Command completed:', result);
 * } catch (error) {
 *   if (error?.message?.includes('cancelled')) {
 *     console.log('Operation was cancelled');
 *   } else {
 *     console.error('Operation failed:', error);
 *   }
 * }
 * ```
 */
export function invokeWithCancel<T>(
  command: string,
  args: Record<string, unknown> = {},
  timeout: number = 60000
): { promise: Promise<T>; cancel: (reason?: string) => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let hasCompleted = false;
  let rejectFn: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    // 保存 reject 函数供 cancel 使用
    rejectFn = reject;

    // 设置超时
    timeoutId = setTimeout(() => {
      if (!hasCompleted) {
        hasCompleted = true;
        reject(new InvokeTimeoutError(command, timeout));
      }
    }, timeout);

    // 执行实际的 invoke 调用
    invoke<T>(command, args)
      .then((result) => {
        if (!hasCompleted) {
          hasCompleted = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!hasCompleted) {
          hasCompleted = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        }
      });
  });

  const cancel = (reason: string = 'Operation cancelled') => {
    if (!hasCompleted && rejectFn) {
      hasCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      rejectFn(new Error(reason));
    }
  };

  return { promise, cancel };
}

/**
 * 默认超时时间（毫秒）
 */
export const DEFAULT_TIMEOUT = 60000;

/**
 * 短超时时间（毫秒） - 用于快速操作
 */
export const SHORT_TIMEOUT = 10000;

/**
 * 长超时时间（毫秒） - 用于可能耗时较长的操作
 */
export const LONG_TIMEOUT = 120000;
