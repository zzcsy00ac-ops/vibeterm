/**
 * 幂等监听器管理器
 *
 * 解决 React StrictMode + 异步监听器注册导致的竞态条件问题
 *
 * ## 问题背景
 *
 * Tauri 的 `listen()` 返回 Promise，unlisten 通过 `.then()` 异步赋值。
 * 在 StrictMode 下，组件会经历挂载→卸载→挂载的过程，导致：
 * 1. 第一次挂载: listen() → Promise 开始
 * 2. 第一次卸载: cleanup() 执行时 unlisten 还是 null
 * 3. 第二次挂载: listen() 再次注册
 * 4. 结果: 两个监听器同时存在
 *
 * ## 解决方案
 *
 * 使用 `pendingRegistrations` Map 跟踪正在进行的注册，实现幂等性：
 * 同一 ID 的多次 `register()` 调用只执行一次注册。
 */

/**
 * 监听器清理函数类型
 */
type UnlistenFn = () => void;

/**
 * 监听器设置函数类型
 */
type SetupFn = () => Promise<UnlistenFn>;

/**
 * 监听器管理器接口
 */
interface IdempotentListenerManager {
  /**
   * 注册监听器（幂等操作）
   * 同一 ID 的多次调用只会执行一次注册
   *
   * @param id - 监听器唯一标识
   * @param setupFn - 返回 cleanup 函数的 Promise
   * @returns cleanup 函数的 Promise
   */
  register(id: string, setupFn: SetupFn): Promise<UnlistenFn>;

  /**
   * 清理指定 ID 的监听器
   *
   * @param id - 监听器唯一标识
   */
  cleanup(id: string): void;

  /**
   * 清理所有监听器
   */
  cleanupAll(): void;
}

/**
 * 创建一个幂等的监听器管理器
 *
 * ## StrictMode 下的执行流程
 *
 * ```
 * 第一次挂载:  register(id) → pendingRegistrations[id] = Promise1
 * 第一次卸载:  cleanup() → listeners[id] 被清理
 *              → pendingRegistrations[id] 仍然存在
 * 第二次挂载:  register(id) → 检查到 pendingRegistrations[id] 存在
 *              → 返回 Promise1（不是创建新的！）
 * Promise1 完成: listeners[id] = cleanup1
 *              → pendingRegistrations.delete(id)
 *
 * 结果：只有一个监听器被注册！
 * ```
 *
 * @returns 监听器管理器对象
 */
export function createIdempotentListenerManager(): IdempotentListenerManager {
  // 已注册的监听器 cleanup 函数
  const listeners = new Map<string, UnlistenFn>();
  // 正在进行的注册 Promise（用于幂等性检查）
  const pendingRegistrations = new Map<string, Promise<UnlistenFn>>();

  return {
    async register(id: string, setupFn: SetupFn): Promise<UnlistenFn> {
      // 幂等性检查：如果正在注册，返回同一个 Promise
      const existing = pendingRegistrations.get(id);
      if (existing) return existing;

      // 创建并执行注册
      const promise = (async () => {
        try {
          // 清理旧的监听器（如果有）
          listeners.get(id)?.();
          listeners.delete(id);

          // 注册新的监听器
          const cleanup = await setupFn();
          listeners.set(id, cleanup);
          return cleanup;
        } finally {
          // 注册完成后移除 pending 标记
          pendingRegistrations.delete(id);
        }
      })();

      pendingRegistrations.set(id, promise);
      return promise;
    },

    /**
     * 清理监听器
     *
     * 注意：不删除 pendingRegistrations 以保持幂等性。
     * 即使 cleanup() 在 Promise 完成前执行，
     * 返回同一个 Promise 也能确保只有一个监听器被注册。
     */
    cleanup(id: string): void {
      listeners.get(id)?.();
      listeners.delete(id);
    },

    /** 清理所有监听器 */
    cleanupAll(): void {
      listeners.forEach((fn) => fn());
      listeners.clear();
      pendingRegistrations.clear();
    },
  };
}
