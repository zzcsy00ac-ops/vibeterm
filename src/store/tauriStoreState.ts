/**
 * Tauri Store 状态持久化类
 *
 * 实现 Zustand persist 中间件的 StateStorage 接口
 * 用于多窗口状态同步和持久化
 */

import { getCurrentWindow } from '@tauri-apps/api/window';
import { load, type Store } from '@tauri-apps/plugin-store';
import { debounce } from 'lodash';
import type { StateStorage } from 'zustand/middleware';
import { storeReadRaw } from '../command';

export type TauriStoreOptions = {
  /** 数据重新加载时的回调函数 */
  onRehydrate?: () => void;
  /** 防抖延迟时间（毫秒） */
  debounce?: number;
  /** 自定义保存函数，用于多窗口同步 */
  saveFn?: (
    currentWindow: Awaited<ReturnType<typeof getCurrentWindow>>,
    storeName: string,
  ) => Promise<void>;
};

export class TauriStoreState implements StateStorage {
  private store: Store | null = null;
  private debouncedSave: (() => void) | null = null;
  private rawData: Record<string, string> | null = null;

  constructor(
    private storename: string,
    private options?: TauriStoreOptions,
  ) {}

  async init() {
    const window = getCurrentWindow();

    // 监听 rehydrate 事件，直接从磁盘读取最新数据
    if (this.options?.onRehydrate) {
      await window.listen('rehydrate', async (event) => {
        const payload = event.payload as string | undefined;

        // 只处理当前 store 的 rehydrate 事件
        if (payload && payload !== this.storename) {
          console.log(`[TauriStore] Ignoring rehydrate event for ${payload}, current store is ${this.storename}`);
          return;
        }

        console.log(`[TauriStore] Rehydrate event received for ${this.storename}`);

        // 先等待从磁盘刷新完成
        await this.refreshFromDisk();

        // 然后触发 Zustand store 的重新水合
        this.options?.onRehydrate?.();
      });
    }

    this.store = await load(this.storename);

    const saveFn = async () => {
      if (this.options?.saveFn) {
        const win = await window;
        this.options.saveFn(win, this.storename);
      } else {
        await this.store?.save();
      }
    };

    this.debouncedSave = this.options?.debounce
      ? debounce(saveFn, this.options.debounce)
      : saveFn;
  }

  /** 直接从磁盘读取最新数据，绕过 Tauri store 的缓存 */
  private async refreshFromDisk() {
    try {
      console.log(`[TauriStore] refreshFromDisk: ${this.storename}`);
      this.rawData = await storeReadRaw(this.storename);
      console.log(`[TauriStore] refreshFromDisk complete, keys:`, Object.keys(this.rawData || {}));
    } catch (error) {
      console.error(`[TauriStore] refreshFromDisk error:`, error);
      // 读取失败时清空缓存，回退到 Tauri store
      this.rawData = null;
    }
  }

  async getItem(name: string): Promise<string | null> {
    // 优先使用从磁盘直接读取的数据
    if (this.rawData && name in this.rawData) {
      const value = this.rawData[name];
      if (value !== undefined) {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    const value = await this.store?.get<string>(name);
    return value ?? null;
  }

  async setItem(name: string, value: string): Promise<void> {
    await this.store?.set(name, value);
    if (this.rawData) {
      this.rawData[name] = value;
    }
    this.debouncedSave?.();
  }

  async removeItem(name: string): Promise<void> {
    await this.store?.delete(name);
    if (this.rawData) {
      delete this.rawData[name];
    }
    this.debouncedSave?.();
  }
}
