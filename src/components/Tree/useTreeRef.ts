import { useRef } from 'react';
import type { TreeNode } from './Tree.types';

/**
 * TreeRef 接口 - 暴露给父组件的方法
 */
export interface TreeRef {
  /** 全部展开 */
  expandAll: () => void;
  /** 全部折叠 */
  collapseAll: () => void;
  /** 展开指定节点 */
  expandNode: (nodeId: string) => void;
  /** 折叠指定节点 */
  collapseNode: (nodeId: string) => void;
  /** 切换节点展开状态 */
  toggleNode: (nodeId: string) => void;
  /** 获取当前展开的节点 ID 列表 */
  getExpandedIds: () => string[];
}

/**
 * 收集所有节点 ID（递归）
 */
function collectNodeIds(node: TreeNode): string[] {
  const ids: string[] = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...collectNodeIds(child));
    }
  }
  return ids;
}

/**
 * useTreeRef 钩子
 *
 * 用于在 TreeComponent 上创建 ref，以便父组件可以控制树的状态
 *
 * @example
 * ```tsx
 * import { useTreeRef } from '@/components/Tree/Tree';
 *
 * const treeRef = useTreeRef();
 *
 * <TreeComponent ref={treeRef} data={treeData} ... />
 *
 * // 全部展开
 * treeRef.current?.expandAll();
 *
 * // 全部折叠
 * treeRef.current?.collapseAll();
 * ```
 */
export function useTreeRef() {
  return useRef<TreeRef>(null);
}

/**
 * 从 ref 获取展开/折叠方法的工具函数（内部使用）
 */
export function createTreeRefHandlers(
  data: TreeNode,
  expandedIds: Set<string>,
  setExpandedIds: (value: React.SetStateAction<Set<string>>) => void
): TreeRef {
  // 收集所有节点 ID
  const allNodeIds = collectNodeIds(data);

  return {
    expandAll: () => {
      setExpandedIds(new Set(allNodeIds));
    },

    collapseAll: () => {
      setExpandedIds(new Set());
    },

    expandNode: (nodeId: string) => {
      setExpandedIds(prev => new Set(prev).add(nodeId));
    },

    collapseNode: (nodeId: string) => {
      setExpandedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    },

    toggleNode: (nodeId: string) => {
      setExpandedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
    },

    getExpandedIds: () => {
      return Array.from(expandedIds);
    },
  };
}

