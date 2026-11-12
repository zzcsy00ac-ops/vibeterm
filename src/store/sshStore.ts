/**
 * SSH 配置管理 Store
 *
 * 使用 Zustand + TauriStoreState 实现持久化和多窗口同步
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TauriStoreState } from './tauriStoreState';
import { storeSave } from '../command';
import type {
  SSHProfile,
  SSHGroup,
  CreateSSHProfileInput,
  UpdateSSHProfileInput,
  CreateGroupInput,
  TreeNode,
} from '../types/ssh';

// ==================== Store 类型 ====================

interface SSHStore {
  // ========== 状态 ==========
  /** 所有 SSH 配置 */
  profiles: SSHProfile[];
  /** 所有分组 */
  groups: SSHGroup[];
  /** 展开的节点 ID 列表 */
  expandedIds: string[];
  /** Store 是否已完成初始化（从持久化存储加载） */
  _hydrated: boolean;

  // ========== 配置 CRUD ==========
  /** 添加 SSH 配置 */
  addProfile: (profile: CreateSSHProfileInput) => string;
  /** 更新 SSH 配置 */
  updateProfile: (id: string, profile: UpdateSSHProfileInput) => void;
  /** 删除 SSH 配置 */
  deleteProfile: (id: string) => void;
  /** 获取单个配置 */
  getProfile: (id: string) => SSHProfile | undefined;
  /** 获取分组下的所有配置 */
  getProfilesByGroup: (groupId: string) => SSHProfile[];

  // ========== 分组 CRUD ==========
  /** 添加分组 */
  addGroup: (group: CreateGroupInput) => string;
  /** 删除分组（及其所有子分组和配置） */
  deleteGroup: (id: string) => void;
  /** 重命名分组 */
  renameGroup: (id: string, name: string) => void;
  /** 获取所有分组 */
  getGroups: () => SSHGroup[];
  /** 获取分组树形结构 */
  getGroupTree: () => TreeNode[];
  /** 移动分组到另一个父分组 */
  moveGroup: (id: string, newParentId: string | null) => void;

  // ========== 查询 ==========
  /** 获取完整的树形结构（分组 + 配置） */
  getTree: () => TreeNode[];

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
 * 生成默认配置值
 */
function getDefaultProfileValues(): Omit<SSHProfile, 'id' | 'name' | 'host'> {
  return {
    type: 'ssh' as const,
    connectionMode: 'direct',
    port: 22,
    authType: 'auto',
    reuseSession: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    groupId: null,
  };
}

/**
 * 生成默认分组值
 */
function getDefaultGroupValues(): Omit<SSHGroup, 'id' | 'name'> {
  return {
    parentId: null,
    children: [],
    profiles: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 递归删除分组及其所有子分组
 */
function deleteGroupRecursively(groupId: string, groups: SSHGroup[]): string[] {
  const group = groups.find(g => g.id === groupId);
  if (!group) return [];

  const deletedIds = [groupId, ...group.children, ...group.profiles];

  // 递归删除子分组
  for (const childId of group.children) {
    const childDeletedIds = deleteGroupRecursively(childId, groups);
    deletedIds.push(...childDeletedIds);
  }

  return deletedIds;
}

/**
 * 递归构建分组树
 */
function buildGroupTree(groups: SSHGroup[], parentId: string | null = null): TreeNode[] {
  return groups
    .filter(g => g.parentId === parentId)
    .map(group => ({
      id: group.id,
      title: group.name,
      isBranch: true,
      type: 'group',
      dataType: 'ssh-group',
      data: group,
      children: [
        ...buildGroupTree(groups, group.id),
        // 配置节点会在 getTree 中添加
      ],
    }));
}

/**
 * 递归添加配置到分组树
 */
function addProfilesToTree(
  tree: TreeNode[],
  profiles: SSHProfile[],
  groups: SSHGroup[]
): TreeNode[] {
  return tree.map(node => {
    if (node.dataType === 'ssh-group' && node.data) {
      const group = node.data as SSHGroup;
      const profileNodes: TreeNode[] = group.profiles
        .map(profileId => profiles.find(p => p.id === profileId))
        .filter((p): p is SSHProfile => p !== undefined)
        .map(profile => ({
          id: profile.id,
          title: profile.name,
          type: 'profile' as const,
          dataType: 'ssh-profile' as const,
          data: profile,
        }));

      return {
        ...node,
        children: [
          ...addProfilesToTree(node.children || [], profiles, groups),
          ...profileNodes,
        ],
      } as TreeNode;
    }

    if (node.children) {
      return {
        ...node,
        children: addProfilesToTree(node.children, profiles, groups),
      } as TreeNode;
    }

    return node;
  });
}

// ==================== 创建存储实例 ====================

// 保存 rehydrate 方法的引用，用于在收到事件时触发
let rehydrateFn: (() => void) | null = null;

const tauriStore = new TauriStoreState('ssh-store.json', {
  // 数据重新加载时的回调（多窗口同步时触发）
  onRehydrate: () => {
    console.log('[SSHStore] Rehydrate event received (multi-window sync)');
    rehydrateFn?.();
  },

  // 防抖延迟时间（毫秒）
  debounce: 100,

  // 自定义保存函数，实现多窗口同步
  saveFn: async (currentWindow, storeName) => {
    console.log('[SSHStore] Saving store and notifying other windows', {
      window: currentWindow.label,
      store: storeName,
    });
    try {
      await storeSave(storeName, currentWindow.label);
    } catch (error) {
      console.error('[SSHStore] Failed to save store:', error);
    }
  },
});

// ==================== 初始化存储 ====================

// 确保 store 初始化完成
await tauriStore.init();

// ==================== 创建 Store ====================

export const useSSHStore = create<SSHStore>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      profiles: [],
      groups: [],
      expandedIds: ['root'], // 默认展开根节点
      _hydrated: false, // 初始未加载持久化数据

      // ========== 配置 CRUD ==========

      addProfile: (profileInput) => {
        const newProfile: SSHProfile = {
          ...getDefaultProfileValues(),
          ...profileInput,
          id: crypto.randomUUID(),
        };

        set((state) => {
          const newProfiles = [...state.profiles, newProfile];

          // 如果有分组，将配置 ID 添加到分组的 profiles 列表
          const newGroups = profileInput.groupId
            ? state.groups.map(g =>
                g.id === profileInput.groupId
                  ? { ...g, profiles: [...g.profiles, newProfile.id], updatedAt: Date.now() }
                  : g
              )
            : state.groups;

          return { profiles: newProfiles, groups: newGroups };
        });

        console.log('[SSHStore] Profile added:', newProfile.id);
        return newProfile.id;
      },

      updateProfile: (id, profileInput) => {
        set((state) => ({
          profiles: state.profiles.map(p =>
            p.id === id
              ? { ...p, ...profileInput, updatedAt: Date.now() }
              : p
          ),
        }));
        console.log('[SSHStore] Profile updated:', id);
      },

      deleteProfile: (id) => {
        set((state) => {
          // 从配置列表中删除
          const newProfiles = state.profiles.filter(p => p.id !== id);

          // 从分组的 profiles 列表中移除
          const newGroups = state.groups.map(g => ({
            ...g,
            profiles: g.profiles.filter(profileId => profileId !== id),
            updatedAt: g.profiles.includes(id) ? Date.now() : g.updatedAt,
          }));

          return { profiles: newProfiles, groups: newGroups };
        });
        console.log('[SSHStore] Profile deleted:', id);
      },

      getProfile: (id) => {
        return get().profiles.find(p => p.id === id);
      },

      getProfilesByGroup: (groupId) => {
        return get().profiles.filter(p => p.groupId === groupId);
      },

      // ========== 分组 CRUD ==========

      addGroup: (groupInput) => {
        const newGroup: SSHGroup = {
          ...getDefaultGroupValues(),
          ...groupInput,
          id: crypto.randomUUID(),
        };

        set((state) => {
          const newGroups = [...state.groups, newGroup];
          // 新创建的分组默认展开
          const newExpandedIds = [...state.expandedIds, newGroup.id];

          // 如果有父分组，将新分组 ID 添加到父分组的 children 列表
          if (groupInput.parentId) {
            return {
              groups: newGroups.map(g =>
                g.id === groupInput.parentId
                  ? { ...g, children: [...g.children, newGroup.id], updatedAt: Date.now() }
                  : g
              ),
              expandedIds: newExpandedIds,
            };
          }

          return { groups: newGroups, expandedIds: newExpandedIds };
        });

        console.log('[SSHStore] Group added:', newGroup.id);
        return newGroup.id;
      },

      deleteGroup: (id) => {
        set((state) => {
          // 递归获取要删除的所有 ID（子分组 + 配置）
          const deletedIds = deleteGroupRecursively(id, state.groups);

          // 过滤掉被删除的分组和配置
          const newGroups = state.groups.filter(g => !deletedIds.includes(g.id));
          const newProfiles = state.profiles.filter(p => !deletedIds.includes(p.id));

          // 从父分组的 children 中移除
          const finalGroups = newGroups.map(g => ({
            ...g,
            children: g.children.filter(childId => !deletedIds.includes(childId)),
            profiles: g.profiles.filter(profileId => !deletedIds.includes(profileId)),
            updatedAt: g.children.includes(id) ? Date.now() : g.updatedAt,
          }));

          // 从 expandedIds 中移除已删除的节点 ID
          const newExpandedIds = state.expandedIds.filter(id => !deletedIds.includes(id));

          return { groups: finalGroups, profiles: newProfiles, expandedIds: newExpandedIds };
        });
        console.log('[SSHStore] Group deleted:', id);
      },

      renameGroup: (id, name) => {
        set((state) => ({
          groups: state.groups.map(g =>
            g.id === id
              ? { ...g, name, updatedAt: Date.now() }
              : g
          ),
        }));
        console.log('[SSHStore] Group renamed:', id, 'to', name);
      },

      moveGroup: (id, newParentId) => {
        set((state) => {
          const group = state.groups.find(g => g.id === id);
          if (!group) return state;

          // 从旧父分组的 children 中移除
          let newGroups = state.groups.map(g => ({
            ...g,
            children: g.children.filter(childId => childId !== id),
            updatedAt: g.children.includes(id) ? Date.now() : g.updatedAt,
          }));

          // 更新分组的 parentId
          newGroups = newGroups.map(g =>
            g.id === id
              ? { ...g, parentId: newParentId, updatedAt: Date.now() }
              : g
          );

          // 添加到新父分组的 children
          if (newParentId) {
            newGroups = newGroups.map(g =>
              g.id === newParentId
                ? { ...g, children: [...g.children, id], updatedAt: Date.now() }
                : g
            );
          }

          return { groups: newGroups };
        });
        console.log('[SSHStore] Group moved:', id, 'to parent:', newParentId);
      },

      getGroups: () => {
        return get().groups;
      },

      getGroupTree: () => {
        const groups = get().groups;
        return buildGroupTree(groups);
      },

      // ========== 查询 ==========

      getTree: () => {
        const state = get();
        const groups = state.groups;
        const profiles = state.profiles;

        // 构建分组树
        const tree = buildGroupTree(groups);

        // 添加配置节点
        const treeWithProfiles = addProfilesToTree(tree, profiles, groups);

        // 添加未分组的配置
        const ungroupedProfiles = profiles.filter(p => !p.groupId);
        if (ungroupedProfiles.length > 0) {
          treeWithProfiles.push({
            id: 'ungrouped',
            title: '未分组',
            type: 'group',
            dataType: 'ssh-group',
            isBranch: true,
            children: ungroupedProfiles.map(p => ({
              id: p.id,
              title: p.name,
              type: 'profile',
              dataType: 'ssh-profile',
              data: p,
            })),
          });
        }

        return treeWithProfiles;
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
        set({ expandedIds: ['root'] });
      },
    }),
    {
      name: 'ssh-store',
      storage: createJSONStorage(() => tauriStore),
      // 在数据恢复完成后标记为已加载
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[SSHStore] Rehydration completed, setting _hydrated = true');
          state._hydrated = true;
        }
      },
    }
  )
);

// 保存 rehydrate 方法供后续使用
rehydrateFn = (useSSHStore as any).persist?.rehydrate;

// ==================== 类型导出 ====================

export type { SSHStore };
