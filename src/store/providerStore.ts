/**
 * Model Provider 配置管理 Store
 *
 * 使用 Zustand + TauriStoreState 实现持久化和多窗口同步
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TauriStoreState } from './tauriStoreState';
import { storeSave } from '../command';
import type {
  ModelProvider,
  ProviderCategory,
  CreateProviderInput,
  UpdateProviderInput,
  CreateCategoryInput,
} from '../types/provider';
import type { TreeNode } from '../components/Tree/Tree.types';
import i18n from '../i18n';

// ==================== Store 类型 ====================

interface ProviderStore {
  // ========== 状态 ==========
  /** 所有供应商配置 */
  providers: ModelProvider[];
  /** 所有分类 */
  categories: ProviderCategory[];
  /** 展开的节点 ID 列表 */
  expandedIds: string[];

  // ========== 供应商 CRUD ==========
  /** 添加供应商配置 */
  addProvider: (provider: CreateProviderInput) => string;
  /** 更新供应商配置 */
  updateProvider: (id: string, provider: UpdateProviderInput) => void;
  /** 删除供应商配置 */
  deleteProvider: (id: string) => void;
  /** 获取单个供应商 */
  getProvider: (id: string) => ModelProvider | undefined;

  // ========== 分类 CRUD ==========
  /** 添加分类 */
  addCategory: (category: CreateCategoryInput) => string;
  /** 删除分类（及其所有子分类和供应商） */
  deleteCategory: (id: string) => void;
  /** 重命名分类 */
  renameCategory: (id: string, name: string) => void;
  /** 移动分类到另一个父分类 */
  moveCategory: (id: string, newParentId: string | null) => void;

  // ========== 查询 ==========
  /** 获取完整的树形结构（分类 + 供应商） */
  getTree: () => TreeNode;

  // ========== 展开状态管理 ==========
  /** 设置展开的节点 ID 列表 */
  setExpandedIds: (ids: string[]) => void;
  /** 切换指定节点的展开状态 */
  toggleExpanded: (id: string) => void;
  /** 重置展开状态（仅保留根节点） */
  resetExpandedIds: () => void;
}

// ==================== 工具函数 ====================

/**
 * 生成默认供应商值
 */
function getDefaultProviderValues(): Omit<ModelProvider, 'id' | 'name' | 'apiKey' | 'requestUrl'> {
  return {
    apiType: 'openai',
    officialUrl: '',
    models: [],
    categoryId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 生成默认分类值
 */
function getDefaultCategoryValues(): Omit<ProviderCategory, 'id' | 'name'> {
  return {
    parentId: null,
    children: [],
    providers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 递归删除分类及其所有子分类
 */
function deleteCategoryRecursively(
  categoryId: string,
  categories: ProviderCategory[]
): string[] {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return [];

  const deletedIds = [categoryId, ...category.children, ...category.providers];

  // 递归删除子分类
  for (const childId of category.children) {
    const childDeletedIds = deleteCategoryRecursively(childId, categories);
    deletedIds.push(...childDeletedIds);
  }

  return deletedIds;
}

/**
 * 递归构建分类树
 */
function buildCategoryTree(
  categories: ProviderCategory[],
  parentId: string | null = null
): TreeNode[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .map((category) => ({
      id: category.id,
      title: category.name,
      isBranch: true,
      type: 'provider-category',
      dataType: 'provider-category',
      data: category,
      children: [
        ...buildCategoryTree(categories, category.id),
        // 供应商节点会在 getTree 中添加
      ],
    }));
}

/**
 * 递归添加供应商到分类树
 */
function addProvidersToTree(
  tree: TreeNode[],
  providers: ModelProvider[],
  categories: ProviderCategory[]
): TreeNode[] {
  return tree.map((node) => {
    if (node.dataType === 'provider-category' && node.data) {
      const category = node.data as ProviderCategory;
      const providerNodes: TreeNode[] = category.providers
        .map((providerId) => providers.find((p) => p.id === providerId))
        .filter((p): p is ModelProvider => p !== undefined)
        .map((provider) => ({
          id: provider.id,
          title: provider.name,
          type: 'provider-item',
          dataType: 'provider-item',
          data: provider,
          configured: !!provider.apiKey,
        }));

      return {
        ...node,
        children: [
          ...addProvidersToTree(node.children || [], providers, categories),
          ...providerNodes,
        ],
      } as TreeNode;
    }

    if (node.children) {
      return {
        ...node,
        children: addProvidersToTree(node.children, providers, categories),
      } as TreeNode;
    }

    return node;
  });
}

// ==================== 创建存储实例 ====================

// 保存 rehydrate 方法的引用，用于在收到事件时触发
let rehydrateFn: (() => void) | null = null;

const tauriStore = new TauriStoreState('provider-store.json', {
  // 数据重新加载时的回调（多窗口同步时触发）
  onRehydrate: () => {
    console.log('[ProviderStore] Rehydrate event received (multi-window sync)');
    rehydrateFn?.();
  },

  // 防抖延迟时间（毫秒）
  debounce: 100,

  // 自定义保存函数，实现多窗口同步
  saveFn: async (currentWindow, storeName) => {
    console.log('[ProviderStore] Saving store and notifying other windows', {
      window: currentWindow.label,
      store: storeName,
    });
    try {
      await storeSave(storeName, currentWindow.label);
    } catch (error) {
      console.error('[ProviderStore] Failed to save store:', error);
    }
  },
});

// ==================== 初始化存储 ====================

// 确保 store 初始化完成
await tauriStore.init();

// ==================== 创建 Store ====================

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      providers: [],
      categories: [],
      expandedIds: ['provider-root'],

      // ========== 供应商 CRUD ==========

      addProvider: (providerInput) => {
        const newProvider: ModelProvider = {
          ...getDefaultProviderValues(),
          ...providerInput,
          // 生成模型 ID
          models: (providerInput.models || []).map((model) => ({
            ...model,
            id: crypto.randomUUID(),
          })),
          id: crypto.randomUUID(),
        };

        set((state) => {
          const newProviders = [...state.providers, newProvider];

          // 如果有分类，将供应商 ID 添加到分类的 providers 列表
          const newCategories = providerInput.categoryId
            ? state.categories.map((c) =>
                c.id === providerInput.categoryId
                  ? {
                      ...c,
                      providers: [...c.providers, newProvider.id],
                      updatedAt: Date.now(),
                    }
                  : c
              )
            : state.categories;

          return { providers: newProviders, categories: newCategories };
        });

        console.log('[ProviderStore] Provider added:', newProvider.id);
        return newProvider.id;
      },

      updateProvider: (id, providerInput) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id
              ? { ...p, ...providerInput, updatedAt: Date.now() }
              : p
          ),
        }));
        console.log('[ProviderStore] Provider updated:', id);
      },

      deleteProvider: (id) => {
        set((state) => {
          // 从供应商列表中删除
          const newProviders = state.providers.filter((p) => p.id !== id);

          // 从分类的 providers 列表中移除
          const newCategories = state.categories.map((c) => ({
            ...c,
            providers: c.providers.filter((providerId) => providerId !== id),
            updatedAt: c.providers.includes(id) ? Date.now() : c.updatedAt,
          }));

          return { providers: newProviders, categories: newCategories };
        });
        console.log('[ProviderStore] Provider deleted:', id);
      },

      getProvider: (id) => {
        return get().providers.find((p) => p.id === id);
      },

      // ========== 分类 CRUD ==========

      addCategory: (categoryInput) => {
        const newCategory: ProviderCategory = {
          ...getDefaultCategoryValues(),
          ...categoryInput,
          id: crypto.randomUUID(),
        };

        set((state) => {
          const newCategories = [...state.categories, newCategory];
          // 新创建的分类默认展开
          const newExpandedIds = [...state.expandedIds, newCategory.id];

          // 如果有父分类，将新分类 ID 添加到父分类的 children 列表
          if (categoryInput.parentId) {
            return {
              categories: newCategories.map((c) =>
                c.id === categoryInput.parentId
                  ? {
                      ...c,
                      children: [...c.children, newCategory.id],
                      updatedAt: Date.now(),
                    }
                  : c
              ),
              expandedIds: newExpandedIds,
            };
          }

          return { categories: newCategories, expandedIds: newExpandedIds };
        });

        console.log('[ProviderStore] Category added:', newCategory.id);
        return newCategory.id;
      },

      deleteCategory: (id) => {
        set((state) => {
          // 递归获取要删除的所有 ID（子分类 + 供应商）
          const deletedIds = deleteCategoryRecursively(id, state.categories);

          // 过滤掉被删除的分类和供应商
          const newCategories = state.categories.filter(
            (c) => !deletedIds.includes(c.id)
          );
          const newProviders = state.providers.filter(
            (p) => !deletedIds.includes(p.id)
          );

          // 从父分类的 children 中移除
          const finalCategories = newCategories.map((c) => ({
            ...c,
            children: c.children.filter((childId) => !deletedIds.includes(childId)),
            providers: c.providers.filter((providerId) =>
              !deletedIds.includes(providerId)
            ),
            updatedAt: c.children.includes(id) ? Date.now() : c.updatedAt,
          }));

          // 从 expandedIds 中移除已删除的节点 ID
          const newExpandedIds = state.expandedIds.filter(
            (id) => !deletedIds.includes(id)
          );

          return {
            categories: finalCategories,
            providers: newProviders,
            expandedIds: newExpandedIds,
          };
        });
        console.log('[ProviderStore] Category deleted:', id);
      },

      renameCategory: (id, name) => {
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, name, updatedAt: Date.now() } : c
          ),
        }));
        console.log('[ProviderStore] Category renamed:', id, 'to', name);
      },

      moveCategory: (id, newParentId) => {
        set((state) => {
          const category = state.categories.find((c) => c.id === id);
          if (!category) return state;

          // 从旧父分类的 children 中移除
          let newCategories = state.categories.map((c) => ({
            ...c,
            children: c.children.filter((childId) => childId !== id),
            updatedAt: c.children.includes(id) ? Date.now() : c.updatedAt,
          }));

          // 更新分类的 parentId
          newCategories = newCategories.map((c) =>
            c.id === id
              ? { ...c, parentId: newParentId, updatedAt: Date.now() }
              : c
          );

          // 添加到新父分类的 children
          if (newParentId) {
            newCategories = newCategories.map((c) =>
              c.id === newParentId
                ? {
                    ...c,
                    children: [...c.children, id],
                    updatedAt: Date.now(),
                  }
                : c
            );
          }

          return { categories: newCategories };
        });
        console.log('[ProviderStore] Category moved:', id, 'to parent:', newParentId);
      },

      // ========== 查询 ==========

      getTree: () => {
        const state = get();
        const categories = state.categories;
        const providers = state.providers;

        // 构建分类树
        const tree = buildCategoryTree(categories);

        // 添加供应商节点
        const treeWithProviders = addProvidersToTree(tree, providers, categories);

        // 添加未分类的供应商
        const ungroupedProviders = providers.filter((p) => !p.categoryId);
        if (ungroupedProviders.length > 0) {
          // @ts-ignore - i18next 类型系统的限制
          treeWithProviders.push({
            id: 'ungrouped',
            // @ts-ignore - i18next 类型系统的限制
            title: i18n.t('provider.ungrouped'),
            type: 'provider-category',
            dataType: 'provider-category',
            isBranch: true,
            children: ungroupedProviders.map((p) => ({
              id: p.id,
              title: p.name,
              type: 'provider-item',
              dataType: 'provider-item',
              data: p,
              configured: !!p.apiKey,
            })),
          });
        }

        return {
          id: 'provider-root',
          title: i18n.t('provider.list'),
          isBranch: true,
          type: 'provider-root',
          children: treeWithProviders,
        };
      },

      // ========== 展开状态管理 ==========

      setExpandedIds: (ids) => {
        set({ expandedIds: ids });
      },

      toggleExpanded: (id) => {
        set((state) => {
          const newExpandedIds = new Set(state.expandedIds);
          if (newExpandedIds.has(id)) {
            newExpandedIds.delete(id);
          } else {
            newExpandedIds.add(id);
          }
          return { expandedIds: Array.from(newExpandedIds) };
        });
      },

      resetExpandedIds: () => {
        set({ expandedIds: ['provider-root'] });
      },
    }),
    {
      name: 'provider-store',
      storage: createJSONStorage(() => tauriStore),
    }
  )
);

// 保存 rehydrate 方法供后续使用
rehydrateFn = (useProviderStore as any).persist?.rehydrate;

// ==================== 类型导出 ====================

export type { ProviderStore };
