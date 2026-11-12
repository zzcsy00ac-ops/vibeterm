import { Folder, FolderOpen, Cpu } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TreeComponent, { useTreeRef } from '../../components/Tree/Tree';
import type { TreeNode, MenuItem } from '../../components/Tree/Tree.types';
import { useProviderStore } from '../../store/providerStore';
import { useShallow } from 'zustand/shallow';
import { Dialog } from '../../components/Dialog';
import type { DialogRef } from '../../components/Dialog/types';
import { ProviderDialog } from '../../components/ProviderDialog/ProviderDialog';
import type { ModelProvider } from '../../types/provider';
import i18n from '../../i18n';

export default function ProviderManager() {
  const { t } = useTranslation();
  const treeRef = useTreeRef();
  const dialogRef = useRef<DialogRef>(null);

  // Provider store - 使用 useShallow 避免 Zustand v5 无限循环
  const { providers, categories, expandedIds, setExpandedIds, getTree } = useProviderStore(
    useShallow((state) => ({
      providers: state.providers,
      categories: state.categories,
      expandedIds: state.expandedIds,
      setExpandedIds: state.setExpandedIds,
      getTree: state.getTree,
    }))
  );

  // 树形数据 - 在组件中计算，当 providers、categories 或语言变化时重新计算
  const treeData: TreeNode = useMemo(() => {
    return getTree();
  }, [providers, categories, i18n.language]);

  // 选中的节点 ID
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Provider dialog state
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [providerDialogMode, setProviderDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | undefined>();
  const [targetCategoryId, setTargetCategoryId] = useState<string | undefined>();

  // 图标配置回调
  const handleGetNodeIcon = (
    node: TreeNode,
    isExpanded: boolean,
    isBranch: boolean
  ): React.ReactNode => {
    if (node.type === 'provider-category') {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }

    if (node.type === 'provider-item') {
      if (node.configured) {
        return <Cpu size={16} className="text-green-500" />;
      }
      return <Cpu size={16} />;
    }

    if (isBranch) {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }

    return <Cpu size={16} />;
  };

  // 右键菜单回调
  const handleContextMenu = (
    node: TreeNode | null,
    _position: { x: number; y: number }
  ): MenuItem[] => {
    // 根节点或空白区域：创建分类、添加供应商、展开/折叠所有
    if (!node || node.id === 'provider-root') {
      return [
        { id: 'create-category', title: t('provider.contextMenu.createCategory') },
        { id: 'add-provider', title: t('provider.contextMenu.addProvider') },
        { id: 'divider-1', title: '', divider: true },
        { id: 'expand-all', title: t('provider.contextMenu.expandAll') },
        { id: 'collapse-all', title: t('provider.contextMenu.collapseAll') },
      ];
    }

    if (node.type === 'provider-category') {
      return [
        { id: 'add-provider', title: t('provider.contextMenu.addProvider'), node },
        { id: 'divider-1', title: '', divider: true },
        { id: 'rename', title: t('provider.contextMenu.rename'), node },
        { id: 'divider-2', title: '', divider: true },
        { id: 'delete', title: t('provider.contextMenu.delete'), node, danger: true },
      ];
    }

    if (node.type === 'provider-item') {
      return [
        { id: 'edit', title: t('provider.contextMenu.edit'), node },
        { id: 'divider-1', title: '', divider: true },
        { id: 'delete', title: t('provider.contextMenu.delete'), node, danger: true },
      ];
    }

    return [];
  };

  // 菜单项点击回调
  const handleMenuItem = (itemId: string, node: TreeNode | null) => {
    switch (itemId) {
      case 'create-category':
        dialogRef.current?.prompt({
          title: t('provider.dialogs.createCategory'),
          placeholder: t('provider.form.categoryName'),
          onConfirm: (name: string) => {
            if (name?.trim()) {
              useProviderStore.getState().addCategory({ name: name.trim() });
            }
          },
        });
        break;

      case 'add-provider': {
        setProviderDialogMode('create');
        setTargetCategoryId(node?.id);
        setSelectedProvider(undefined);
        setProviderDialogOpen(true);
        break;
      }

      case 'edit':
        if (node?.data) {
          setProviderDialogMode('edit');
          setSelectedProvider(node.data as ModelProvider);
          setProviderDialogOpen(true);
        }
        break;

      case 'rename':
        if (node?.data) {
          dialogRef.current?.prompt({
            title: t('provider.dialogs.renameCategory'),
            placeholder: t('provider.form.categoryName'),
            defaultValue: (node.data as any).name || '',
            onConfirm: (newName: string) => {
              if (newName?.trim()) {
                useProviderStore.getState().renameCategory(node.id, newName.trim());
              }
            },
          });
        }
        break;

      case 'delete':
        dialogRef.current?.confirm({
          title: t('provider.dialogs.deleteConfirmTitle'),
          message:
            node?.type === 'provider-category'
              ? t('provider.dialogs.deleteCategoryConfirm', { name: node.title })
              : t('provider.dialogs.deleteProviderConfirm', { name: (node as TreeNode).title }),
          type: 'danger',
          onConfirm: () => {
            if (node?.type === 'provider-category') {
              useProviderStore.getState().deleteCategory(node.id);
            } else if (node?.type === 'provider-item') {
              useProviderStore.getState().deleteProvider(node.id);
            }
          },
        });
        break;

      case 'expand-all':
        treeRef.current?.expandAll();
        break;

      case 'collapse-all':
        treeRef.current?.collapseAll();
        break;
    }
  };

  // Provider dialog 提交
  const handleProviderSubmit = (data: any) => {
    const { addProvider, updateProvider } = useProviderStore.getState();

    if (providerDialogMode === 'create') {
      addProvider({
        ...data,
        categoryId: targetCategoryId || null,
      });
    } else if (providerDialogMode === 'edit' && selectedProvider) {
      updateProvider(selectedProvider.id, data);
    }
  };

  const handleSelectedChange = (nodeId: string | null) => {
    setSelectedId(nodeId);
  };

  return (
    <>
      <TreeComponent
        ref={treeRef}
        data={treeData}
        onContextMenu={handleContextMenu}
        onItem={handleMenuItem}
        getNodeIcon={handleGetNodeIcon}
        onSelectedChange={handleSelectedChange}
        selectedId={selectedId ?? undefined}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        className="provider-tree"
      />

      <Dialog ref={dialogRef} />

      {providerDialogOpen && (
        <ProviderDialog
          open={providerDialogOpen}
          onOpenChange={setProviderDialogOpen}
          mode={providerDialogMode}
          initialData={selectedProvider}
          onSubmit={handleProviderSubmit}
        />
      )}
    </>
  );
}
