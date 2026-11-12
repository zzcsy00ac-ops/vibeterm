import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Server,
  Database,
  Cloud,
  Globe,
  Wrench,
  Factory,
  Beaker,
  HardDrive,
  Terminal,
  Plus,
  Folder,
  Edit,
  Trash2,
  UnfoldHorizontal,
  FoldHorizontal,
  type LucideIcon,
} from 'lucide-react';
import TreeComponent, { useTreeRef } from '../../components/Tree/Tree';
import type { TreeNode, MenuItem } from '../../components/Tree/Tree.types';
import { useAppStore } from '../../store/appStore';
import { useSSHStore } from '../../store/sshStore';
import { CreateGroupDialog } from '../../components/CreateGroupDialog/CreateGroupDialog';
import { SSHProfileDialog } from '../../components/SSHProfileDialog/SSHProfileDialog';
import { RenameGroupDialog } from '../../components/RenameGroupDialog/RenameGroupDialog';
import { DeleteConfirmDialog, type DeleteType } from '../../components/DeleteConfirmDialog/DeleteConfirmDialog';
import type { SSHProfile } from '../../types/ssh';

export default function SshManager() {
  const { addTab } = useAppStore();
  const { t } = useTranslation();
  const getTree = useSSHStore(state => state.getTree);
  const deleteGroup = useSSHStore(state => state.deleteGroup);
  const deleteProfile = useSSHStore(state => state.deleteProfile);
  const expandedIds = useSSHStore(state => state.expandedIds);
  const setExpandedIds = useSSHStore(state => state.setExpandedIds);
  // 树形 ref - 用于外部控制展开/折叠
  const treeRef = useTreeRef();

  // 选中的节点 ID
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 对话框状态
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);
  const [renameGroupDialogOpen, setRenameGroupDialogOpen] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [parentGroupId, setParentGroupId] = useState<string>();

  // 重命名分组状态
  const [renameGroupId, setRenameGroupId] = useState<string>('');
  const [renameGroupName, setRenameGroupName] = useState<string>('');

  // 删除确认状态
  const [deleteType, setDeleteType] = useState<DeleteType>('group');
  const [deleteName, setDeleteName] = useState<string>('');
  const [deleteCallback, setDeleteCallback] = useState<(() => void)>(() => () => {});

  // 编辑配置状态
  const [editProfileId, setEditProfileId] = useState<string>('');

  // 获取树形数据（从 store 获取的是数组）
  const treeChildren = getTree();

  // 创建根节点，使用 i18n 翻译
  // 同时处理 "未分组" 节点的国际化
  const localizedTreeChildren = treeChildren.map(node => ({
    ...node,
    title: node.id === 'ungrouped' ? t('ssh.form.unassigned') : node.title,
  }));

  const treeData: TreeNode = {
    id: 'root',
    title: t('ssh.sessions'),
    type: 'root',
    isBranch: true,
    children: localizedTreeChildren,
  };

  // 图标映射（与 Sidebar.tsx 中的 ICON_OPTIONS 保持一致）
  const ICON_MAP: Record<string, LucideIcon> = {
    server: Server,
    database: Database,
    cloud: Cloud,
    network: Globe,
    development: Wrench,
    production: Factory,
    staging: Beaker,
    backup: HardDrive,
  };

  // 图标配置回调
  const handleGetNodeIcon = (
    node: TreeNode,
    _isExpanded: boolean,
    _isBranch: boolean
  ): React.ReactNode => {
    if (node.dataType === 'ssh-profile' && node.data) {
      const profile = node.data as SSHProfile;
      // 如果 profile 有 icon 字段且在映射表中，使用对应图标
      if (profile.icon && ICON_MAP[profile.icon]) {
        const IconComponent = ICON_MAP[profile.icon];
        return <IconComponent size={16} />;
      }
      // 默认使用 Terminal 图标
      return <Terminal size={16} />;
    }
    if (node.dataType === 'ssh-group' || node.type === 'group') {
      return <Server size={16} />;
    }
    return null;
  };

  // 右键菜单回调
  const handleContextMenu = (
    node: TreeNode | null,
    _position: { x: number; y: number }
  ): MenuItem[] => {
    const items: MenuItem[] = [];

    if (!node || node.id === 'root' || node.id === 'ungrouped') {
      // 根节点或空白区域：创建分组、全部展开、全部折叠
      items.push({
        id: 'create-group',
        title: t('ssh.contextMenu.createGroup'),
        icon: <Plus size={14} />,
        node,
      });
      items.push({
        id: 'divider-expand',
        title: '',
        divider: true,
        node,
      });
      items.push({
        id: 'expand-all',
        title: t('ssh.contextMenu.expandAll'),
        icon: <UnfoldHorizontal size={14} />,
        node,
      });
      items.push({
        id: 'collapse-all',
        title: t('ssh.contextMenu.collapseAll'),
        icon: <FoldHorizontal size={14} />,
        node,
      });
    } else if (node.dataType === 'ssh-group' || node.type === 'group') {
      // 分组节点：创建子分组、创建配置、重命名、删除
      items.push({
        id: 'create-subgroup',
        title: t('ssh.contextMenu.createSubgroup'),
        icon: <Folder size={14} />,
        node,
      });
      items.push({
        id: 'create-profile',
        title: t('ssh.contextMenu.createProfile'),
        icon: <Plus size={14} />,
        node,
      });
      items.push({
        id: 'divider-1',
        title: '',
        divider: true,
        node,
      });
      items.push({
        id: 'rename-group',
        title: t('ssh.contextMenu.rename'),
        icon: <Edit size={14} />,
        node,
      });
      items.push({
        id: 'delete-group',
        title: t('ssh.contextMenu.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        node,
      });
    } else if (node.dataType === 'ssh-profile' || node.type === 'profile') {
      // SSH 配置节点：编辑、删除
      items.push({
        id: 'edit-profile',
        title: t('ssh.contextMenu.edit'),
        icon: <Edit size={14} />,
        node,
      });
      items.push({
        id: 'delete-profile',
        title: t('ssh.contextMenu.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        node,
      });
    }

    return items;
  };

  // 菜单项点击回调
  const handleMenuItem = (itemId: string, node: TreeNode | null) => {
    console.log(`[SshManager] Menu item ${itemId} clicked`, node);

    switch (itemId) {
      case 'create-group':
        setParentGroupId(undefined);
        setCreateGroupDialogOpen(true);
        break;

      case 'create-subgroup':
        setParentGroupId(node?.id);
        setCreateGroupDialogOpen(true);
        break;

      case 'create-profile':
        setParentGroupId(node?.id);
        setCreateProfileDialogOpen(true);
        break;

      case 'rename-group':
        if (node?.id) {
          setRenameGroupId(node.id);
          setRenameGroupName(node.title);
          setRenameGroupDialogOpen(true);
        }
        break;

      case 'delete-group':
        if (node?.id) {
          setDeleteType('group');
          setDeleteName(node.title);
          setDeleteCallback(() => () => deleteGroup(node.id));
          setDeleteConfirmDialogOpen(true);
        }
        break;

      case 'edit-profile':
        if (node?.id) {
          setEditProfileId(node.id);
          setCreateProfileDialogOpen(true);
        }
        break;

      case 'delete-profile':
        if (node?.id) {
          setDeleteType('profile');
          setDeleteName(node.title);
          setDeleteCallback(() => () => deleteProfile(node.id));
          setDeleteConfirmDialogOpen(true);
        }
        break;

      case 'expand-all':
        treeRef.current?.expandAll();
        break;

      case 'collapse-all':
        treeRef.current?.collapseAll();
        break;
    }
  };

  // 节点点击 - 打开标签
  const handleNodeClick = (node: TreeNode) => {
    if (node.dataType === 'ssh-profile' || node.type === 'profile') {
      const profile = node.data as SSHProfile;
      if (profile) {
        // 生成唯一的 session ID（profile ID + 时间戳）
        const sessionId = `${node.id}-${Date.now()}`;
        // 使用新的 SSH 终端组件，传递完整的连接信息
        addTab({
          title: node.title,
          key: 'ssh-terminal',
          params: {
            sessionId,
            host: profile.host,
            port: profile.port,
            username: profile.username,
            privateKeyPath: profile.privateKeyPath,
            // 密码将从 Keyring 动态获取
          },
        });
      }
    }
  };

  const handleSelectedChange = (nodeId: string | null) => {
    setSelectedId(nodeId);
  };

  // 分组创建成功
  const handleGroupCreated = () => {
    console.log('[SshManager] Group created successfully');
  };

  // 分组重命名成功
  const handleGroupRenamed = () => {
    console.log('[SshManager] Group renamed successfully');
  };

  // 配置创建/编辑成功
  const handleProfileSaved = () => {
    console.log('[SshManager] Profile saved successfully');
    // 清除编辑状态
    setEditProfileId('');
  };

  // 删除确认回调
  const handleDeleteConfirm = () => {
    deleteCallback();
    console.log('[SshManager] Delete completed');
  };

  // 关闭编辑配置对话框时清除状态
  const handleProfileDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditProfileId('');
    }
    setCreateProfileDialogOpen(open);
  };

  return (
    <>
      <TreeComponent
        ref={treeRef}
        data={treeData}
        onContextMenu={handleContextMenu}
        onItem={handleMenuItem}
        getNodeIcon={handleGetNodeIcon}
        onNodeClick={handleNodeClick}
        onSelectedChange={handleSelectedChange}
        selectedId={selectedId ?? undefined}
        className="ssh-tree"
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
      />

      {/* 创建分组对话框 */}
      <CreateGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        parentGroupId={parentGroupId}
        onSuccess={handleGroupCreated}
      />

      {/* 重命名分组对话框 */}
      <RenameGroupDialog
        open={renameGroupDialogOpen}
        onOpenChange={setRenameGroupDialogOpen}
        groupId={renameGroupId}
        currentName={renameGroupName}
        onSuccess={handleGroupRenamed}
      />

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteConfirmDialogOpen}
        onOpenChange={setDeleteConfirmDialogOpen}
        type={deleteType}
        name={deleteName}
        onConfirm={handleDeleteConfirm}
      />

      {/* 创建/编辑 SSH 配置对话框 */}
      <SSHProfileDialog
        open={createProfileDialogOpen}
        onOpenChange={handleProfileDialogOpenChange}
        mode={editProfileId ? 'edit' : 'create'}
        profileId={editProfileId}
        parentGroupId={parentGroupId}
        onSuccess={handleProfileSaved}
      />
    </>
  );
}
