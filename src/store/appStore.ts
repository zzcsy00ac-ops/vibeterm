/**
 * 应用全局状态管理
 *
 * 使用 Zustand + Tauri Plugin-Store 实现持久化和多窗口同步
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TauriStoreState } from './tauriStoreState';
import { storeSave } from '../command';
import type { ThemeMode, Language } from '../schemas/settings';
import type { SideToolItem } from '../components/SideTools/types';
import { DEFAULT_SIDE_TOOLS_ITEMS } from '../components/SideTools/types';
import { ROUTE_ICON_MAP, SPECIAL_ICON_MAP } from '../components/SideTools/types';

// ==================== 类型定义 ====================

type ThemeAppearance = 'light' | 'dark';

/**
 * 标签页接口
 *
 * 使用"Key + Params"模式，Tab 类似路由，只描述"显示什么"，不包含实际组件
 * - id: 唯一标识符
 * - title: 标签标题（显示在标签栏）
 * - key: 视图类型标识（对应 TAB_REGISTRY 中的组件）
 * - params: 传递给组件的参数（可选）
 *
 * 所有字段都可序列化，支持完全持久化
 */
export interface Tab {
  id: string;          // 唯一标识
  title: string;       // 标签标题
  key: string;         // 视图标识（如 'session', 'ssh', 'chat'）
  params?: any;        // 组件参数（可选，传递给对应组件的 props）
}

/**
 * 终端样式配置
 */
export interface TerminalConfig {
  /** 终端主题 */
  theme: 'dark' | 'light';
  /** 字体大小 */
  fontSize: number;
  /** 字体系列 */
  fontFamily: string;
  /** 光标是否闪烁 */
  cursorBlink: boolean;
  /** 滚动回放行数 */
  scrollback: number;
}

interface AppStore {
  // 侧边栏状态
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // 更新提示
  needUpdate: boolean;
  setNeedUpdate: (value: boolean) => void;

  // 主题相关
  themeMode: ThemeMode;
  systemTheme: ThemeAppearance;
  setThemeMode: (mode: ThemeMode) => void;
  updateSystemTheme: () => void;

  // 语言相关
  language: Language;
  setLanguage: (lang: Language) => void;

  // 终端配置相关
  terminalConfig: TerminalConfig;
  setTerminalConfig: (config: Partial<TerminalConfig>) => void;
  resetTerminalConfig: () => void;

  // 标签页相关
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;

  // 侧边栏工具栏相关
  sideToolsItems: SideToolItem[];
  moveSideToolItem: (fromIndex: number, toIndex: number) => void;
  updateSideToolItem: (id: string, updates: Partial<SideToolItem>) => void;
  resetSideToolsItems: () => void;
  /** 获取第一个可导航的路由（用于默认页面） */
  getFirstNavigableRoute: () => string | null;

  // 默认模型设置
  /** 默认供应商 ID */
  defaultProviderId: string | null;
  /** 默认模型 ID */
  defaultModelId: string | null;
  /** 设置默认模型 */
  setDefaultModel: (providerId: string, modelId: string) => void;
  /** 清除默认模型设置 */
  clearDefaultModel: () => void;
}

// ==================== 工具函数 ====================

/**
 * 默认终端配置
 */
const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
  cursorBlink: true,
  scrollback: 1000,
};

/**
 * 获取系统主题
 */
function getSystemTheme(): ThemeAppearance {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 计算实际外观
 */
function computeAppearance(themeMode: ThemeMode, systemTheme: ThemeAppearance): ThemeAppearance {
  return themeMode === 'system' ? systemTheme : themeMode;
}

/**
 * 更新系统主题
 */
function syncSystemTheme() {
  const actualSystemTheme = getSystemTheme();
  const currentState = useAppStore.getState();

  if (currentState.systemTheme !== actualSystemTheme) {
    console.log('[StoreSync] Updating systemTheme', {
      old: currentState.systemTheme,
      new: actualSystemTheme,
    });
    useAppStore.getState().updateSystemTheme();
  }
}

// ==================== 创建存储实例 ====================

// 保存 rehydrate 方法的引用，用于在收到事件时触发
let rehydrateFn: (() => void) | null = null;

const tauriStore = new TauriStoreState('app-store.json', {
  // 数据重新加载时的回调（多窗口同步时触发）
  onRehydrate: () => {
    console.log('[StoreSync] Rehydrate event received (multi-window sync)');
    // 调用 persist 中间件的 rehydrate 方法
    rehydrateFn?.();

    // 同步系统主题
    syncSystemTheme();
  },

  // 防抖延迟时间（毫秒）
  debounce: 100,

  // 自定义保存函数，实现多窗口同步
  saveFn: async (currentWindow, storeName) => {
    console.log('[StoreSync] Saving store and notifying other windows', {
      window: currentWindow.label,
      store: storeName,
    });
    try {
      await storeSave(storeName, currentWindow.label);
    } catch (error) {
      console.error('[StoreSync] Failed to save store:', error);
    }
  },
});

// ==================== 初始化存储 ====================

// 确保 store 初始化完成
await tauriStore.init();

// ==================== 创建 Store ====================

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      isSidebarCollapsed: false,
      needUpdate: false,
      themeMode: 'system',
      systemTheme: getSystemTheme(),
      language: 'auto',
      terminalConfig: DEFAULT_TERMINAL_CONFIG,
      tabs: [],
      activeTabId: null,
      sideToolsItems: DEFAULT_SIDE_TOOLS_ITEMS,
      defaultProviderId: null,
      defaultModelId: null,

      // Actions
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setNeedUpdate: (value) => set({ needUpdate: value }),

      setThemeMode: (mode) => set({ themeMode: mode }),

      updateSystemTheme: () => set((state) => ({ ...state, systemTheme: getSystemTheme() })),

      setLanguage: (lang) => set({ language: lang }),

      // 终端配置操作
      setTerminalConfig: (config) => set((state) => ({
        terminalConfig: { ...state.terminalConfig, ...config }
      })),

      resetTerminalConfig: () => set({ terminalConfig: DEFAULT_TERMINAL_CONFIG }),

      // 标签页操作
      addTab: (tab) => set((state) => {
        // 对于 chat 类型的标签页，检查是否已存在相同 chatId 的标签页
        if (tab.key === 'chat' && tab.params?.chatId) {
          const existingTab = state.tabs.find(
            (t) => t.key === 'chat' && t.params?.chatId === tab.params.chatId
          );
          if (existingTab) {
            // 如果已存在，只切换到该标签页（不重复打开）
            return {
              activeTabId: existingTab.id,
            };
          }
        }

        // 不存在或不是 chat 类型，创建新标签页
        const newTab: Tab = {
          ...tab,
          id: crypto.randomUUID(),
        };
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
        };
      }),

      closeTab: (tabId) => set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== tabId);
        const newActiveTabId =
          state.activeTabId === tabId ? (newTabs[0]?.id || null) : state.activeTabId;
        return {
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      }),

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      moveTab: (fromIndex, toIndex) =>
        set((state) => {
          const newTabs = [...state.tabs];
          const [movedTab] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, movedTab);
          return { tabs: newTabs };
        }),

      // 侧边栏工具栏操作
      moveSideToolItem: (fromIndex, toIndex) =>
        set((state) => {
          const newItems = [...state.sideToolsItems];
          const [movedItem] = newItems.splice(fromIndex, 1);
          newItems.splice(toIndex, 0, movedItem);
          return { sideToolsItems: newItems };
        }),

      updateSideToolItem: (id, updates) =>
        set((state) => ({
          sideToolsItems: state.sideToolsItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      resetSideToolsItems: () => set({ sideToolsItems: DEFAULT_SIDE_TOOLS_ITEMS }),

      getFirstNavigableRoute: () => {
        const state = get();
        // 找到第一个可见且有路由的项
        const firstNavigable = state.sideToolsItems.find(
          (item: SideToolItem) => item.visible !== false && item.route
        );
        return firstNavigable?.route || null;
      },

      // 默认模型设置
      setDefaultModel: (providerId, modelId) => set({
        defaultProviderId: providerId,
        defaultModelId: modelId,
      }),

      clearDefaultModel: () => set({
        defaultProviderId: null,
        defaultModelId: null,
      }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => tauriStore),

      // 排除列表：不持久化的字段
      // 默认所有状态都会持久化，只有在此列表中的字段不会被持久化
      partialize: (state) => {
        // 创建持久化状态的副本
        const persistedState = { ...state };

        // 排除不需要持久化的字段
        delete (persistedState as any).systemTheme;   // 每次启动时重新获取
        delete (persistedState as any).needUpdate;    // 临时状态

        return persistedState;
      },
    }
  ),
);

// 保存 rehydrate 方法供后续使用
// persist 中间件会在 store 上添加 persist.rehydrate 方法
rehydrateFn = (useAppStore as any).persist?.rehydrate;

// ==================== 应用启动时的初始化恢复 ====================

// 应用启动时立即执行一次恢复逻辑
//（onRehydrate 只在多窗口同步时触发，首次启动不会触发）
console.log('[StoreSync] Initial restore on app startup');
syncSystemTheme();

// ==================== 数据迁移 ====================

// 迁移旧的 settings ID 为 mores
setTimeout(() => {
  const currentState = useAppStore.getState();
  const hasOldSettings = currentState.sideToolsItems.some(item => item.id === 'settings');

  if (hasOldSettings) {
    console.log('[StoreSync] Migrating old settings ID to mores');
    useAppStore.setState((state) => ({
      sideToolsItems: state.sideToolsItems.map((item) =>
        item.id === 'settings'
          ? { ...item, id: 'mores', title: 'app.mores' }
          : item
      ),
    }));
  }
}, 100);

// ==================== 辅助函数 ====================

/**
 * 获取计算后的主题外观
 */
export const getComputedAppearance = (store: AppStore): ThemeAppearance => {
  return computeAppearance(store.themeMode, store.systemTheme);
};

// ==================== 系统主题监听 ====================

if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleSystemThemeChange = () => {
    console.log('[StoreSync] System theme changed');
    const newSystemTheme = getSystemTheme();
    const currentSystemTheme = useAppStore.getState().systemTheme;

    // 只有当系统主题实际改变时才更新
    if (newSystemTheme !== currentSystemTheme) {
      useAppStore.getState().updateSystemTheme();
    }
  };

  mediaQuery.addEventListener('change', handleSystemThemeChange);
}

// ==================== 类型导出 ====================

export type { AppStore };

// ==================== 派生状态 Hook ====================

/**
 * 获取带图标的侧边栏工具栏项
 *
 * 这个 hook 动态地将图标注入到 sideToolsItems 中，
 * 避免将 React 组件存储在状态中（不能被序列化）。
 *
 * 图标映射逻辑：
 * 1. 优先通过 route 查找（如 '/chats' → MessageSquare）
 * 2. 如果没有 route，通过特殊 ID 查找（如 'sidebar-toggle' → PanelLeftDashed）
 *
 * 使用方法：
 * ```tsx
 * const sideToolsItems = useSideToolsItems();
 * ```
 */
export function useSideToolsItems(): SideToolItem[] {
  const items = useAppStore((state) => state.sideToolsItems);

  // 动态注入图标，确保图标总是最新的
  return items.map((item) => ({
    ...item,
    // 优先通过 route 查找，否则通过特殊 ID 查找
    icon: item.route ? ROUTE_ICON_MAP[item.route] : SPECIAL_ICON_MAP[item.id],
  }));
}
