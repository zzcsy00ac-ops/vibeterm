# TreeComponent 使用文档

通用树形组件，支持展开/折叠、右键菜单、自定义图标、节点选中等功能。

## 功能特性

- **分支节点支持**：通过 `isBranch` 字段明确标识分支节点（包括空分组）
- **右键菜单**：支持空白区域、分支节点、叶子节点的不同菜单配置
- **图标自定义**：通过回调函数灵活配置节点图标
- **状态管理**：内部管理展开/折叠状态（组件内部模式，新打开 app 默认折叠）
- **节点选中**：支持叶子节点点击选中，高亮显示
- **外部控制**：通过 `useTreeRef` 实现全部展开/折叠功能

## 完整示例：SSH 会话管理

```tsx
import { Folder, FolderOpen, Terminal, Server } from 'lucide-react';
import { useState } from 'react';
import TreeComponent, { useTreeRef } from '@/components/Tree/Tree';
import type { TreeNode, MenuItem } from '@/components/Tree/Tree.types';

export default function Sessions() {
  // 树形 ref - 用于外部控制展开/折叠
  const treeRef = useTreeRef();

  // 选中的节点 ID
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 树形数据
  const treeData: TreeNode = {
    id: 'root',
    title: 'SSH 会话',
    isBranch: true,
    children: [
      {
        id: 'group1',
        title: '生产环境',
        isBranch: true, // 明确标识为分支节点
        type: 'group',
        children: [
          {
            id: 'session1',
            title: 'Web Server',
            type: 'session',
            host: '192.168.1.100',
            port: 22,
            user: 'root',
            connected: false,
          },
          {
            id: 'session2',
            title: 'DB Server',
            type: 'session',
            host: '192.168.1.101',
            port: 22,
            user: 'admin',
            connected: false,
          },
        ],
      },
      {
        id: 'group2',
        title: '开发环境',
        isBranch: true,
        type: 'group',
        children: [
          {
            id: 'session3',
            title: 'Dev Server',
            type: 'session',
            host: '192.168.2.100',
            port: 22,
            user: 'dev',
            connected: false,
          },
        ],
      },
      {
        id: 'group3',
        title: '空分组（新建）',
        isBranch: true, // 空分组但明确标识为分支
        type: 'group',
        children: [], // 空数组
      },
    ],
  };

  // 图标配置回调
  const handleGetNodeIcon = (
    node: TreeNode,
    isExpanded: boolean,
    isBranch: boolean
  ): React.ReactNode => {
    // 方法 1: 通过 type 字段判断
    if (node.type === 'group') {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }

    if (node.type === 'session') {
      // 根据会话状态返回不同图标
      if (node.connected) {
        return <Terminal size={16} className="text-green-500" />;
      }
      return <Terminal size={16} />;
    }

    // 方法 2: 通过 isBranch 判断（通用方式）
    if (isBranch) {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }

    // 默认叶子节点图标
    return <Server size={16} />;
  };

  // 右键菜单回调 - 返回菜单配置数组
  const handleContextMenu = (
    node: TreeNode | null,
    _position: { x: number; y: number }
  ): MenuItem[] => {
    // 空白区域右键
    if (node === null) {
      return [
        { id: 'create-group', title: '新建分组' },
        { id: 'create-session', title: '新建会话' },
        { id: 'divider-1', title: '', divider: true },
        { id: 'refresh', title: '刷新列表' },
        { id: 'expand-all', title: '全部展开' },
        { id: 'collapse-all', title: '全部折叠' },
      ];
    }

    // 分组节点右键
    if (node.type === 'group') {
      return [
        { id: 'add-subgroup', title: '添加子分组', node },
        { id: 'add-session', title: '添加会话', node },
        { id: 'divider-1', title: '', divider: true },
        { id: 'rename', title: '重命名', node },
        { id: 'divider-2', title: '', divider: true },
        { id: 'delete', title: '删除分组', node, danger: true },
      ];
    }

    // 会话节点右键
    if (node.type === 'session') {
      return [
        { id: 'connect', title: '连接', node },
        { id: 'disconnect', title: '断开连接', node, disabled: !node.connected },
        { id: 'divider-1', title: '', divider: true },
        { id: 'edit', title: '编辑', node },
        { id: 'duplicate', title: '复制', node },
        { id: 'divider-2', title: '', divider: true },
        { id: 'delete', title: '删除会话', node, danger: true },
      ];
    }

    return [];
  };

  // 菜单项点击回调
  const handleMenuItem = (itemId: string, node: TreeNode | null) => {
    switch (itemId) {
      case 'create-group':
        console.log('Creating new group');
        break;

      case 'add-subgroup':
        console.log('Adding subgroup to:', node?.id);
        break;

      case 'add-session':
        console.log('Adding session to:', node?.id);
        break;

      case 'connect':
        console.log('Connecting to:', node?.host);
        break;

      case 'edit':
        console.log('Editing node:', node?.id);
        break;

      case 'delete':
        console.log('Deleting node:', node?.id);
        break;

      case 'refresh':
        console.log('Refreshing tree');
        break;

      case 'expand-all':
        treeRef.current?.expandAll();
        break;

      case 'collapse-all':
        treeRef.current?.collapseAll();
        break;
    }
  };

  // 节点点击回调
  const handleNodeClick = (node: TreeNode) => {
    console.log('Node clicked:', node);
  };

  // 选中节点变化回调
  const handleSelectedChange = (nodeId: string | null) => {
    setSelectedId(nodeId);
    console.log('Selected node:', nodeId);
  };

  return (
    <TreeComponent
      ref={treeRef}
      data={treeData}
      onContextMenu={handleContextMenu}
      onItem={handleMenuItem}
      getNodeIcon={handleGetNodeIcon}
      onNodeClick={handleNodeClick}
      onSelectedChange={handleSelectedChange}
      selectedId={selectedId ?? undefined}
      className="sessions-tree"
    />
  );
}
```

## API 参考

### TreeComponent Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `TreeNode` | 是 | 树形数据根节点 |
| `onContextMenu` | `ContextMenuCallback` | 是 | 右键菜单回调 |
| `onItem` | `MenuItemCallback` | 是 | 菜单项点击回调 |
| `getNodeIcon` | `NodeIconGetter` | 否 | 获取节点图标 |
| `onNodeClick` | `NodeClickCallback` | 否 | 节点点击回调 |
| `onNodeToggle` | `NodeToggleCallback` | 否 | 节点展开/折叠回调 |
| `selectedId` | `string` | 否 | 当前选中的节点 ID |
| `onSelectedChange` | `SelectedChangeCallback` | 否 | 选中节点变化回调 |
| `className` | `string` | 否 | 自定义 CSS 类名 |
| `ref` | `RefObject<TreeRef>` | 否 | 用于外部控制的 ref |

### TreeNode 数据结构

```typescript
interface TreeNode {
  id: string;           // 唯一标识
  title: string;        // 显示标题
  isBranch?: boolean;   // 是否为分支节点（关键！）
  children?: TreeNode[];  // 子节点
  type?: string;        // 业务类型（用于右键菜单等业务逻辑判断）
  [key: string]: any;   // 扩展字段（如 host, port, user, connected 等）
}
```

**重要说明**：
- `isBranch` 字段用于明确标识分支节点
- 对于空分组（`children: []`），必须设置 `isBranch: true`
- 如果不设置 `isBranch`，组件会通过 `children.length > 0` 自动判断

### MenuItem 菜单项配置

```typescript
interface MenuItem {
  id: string;           // 菜单项唯一标识
  title: string;        // 显示文本
  icon?: ReactNode;     // 可选图标
  node?: TreeNode;      // 关联的节点
  disabled?: boolean;   // 是否禁用
  divider?: boolean;    // 是否分隔线
  danger?: boolean;     // 是否危险操作（红色显示）
}
```

### 节点选中

**选中回调类型**：
```typescript
type SelectedChangeCallback = (nodeId: string | null) => void;
```

**点击行为**：
- **分支节点** (`isBranch: true`)：点击展开/折叠，不触发选中
- **叶子节点**：点击选中，触发 `onSelectedChange(nodeId)`

**基本用法**：
```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);

<TreeComponent
  selectedId={selectedId ?? undefined}
  onSelectedChange={(nodeId) => {
    setSelectedId(nodeId);
    // 处理选中逻辑，如加载详情等
  }}
  ...
/>
```

## 外部控制：useTreeRef

通过 `useTreeRef` 钩子，可以在父组件中控制树的展开/折叠状态：

### TreeRef 接口

```typescript
interface TreeRef {
  expandAll: () => void;           // 全部展开
  collapseAll: () => void;         // 全部折叠
  expandNode: (nodeId: string) => void;    // 展开指定节点
  collapseNode: (nodeId: string) => void;  // 折叠指定节点
  toggleNode: (nodeId: string) => void;    // 切换节点状态
  getExpandedIds: () => string[];   // 获取展开的节点列表
}
```

### 使用示例

```tsx
import TreeComponent, { useTreeRef } from '@/components/Tree/Tree';

const treeRef = useTreeRef();

// 在右键菜单处理中调用
case 'expand-all':
  treeRef.current?.expandAll();
  break;
case 'collapse-all':
  treeRef.current?.collapseAll();
  break;
```

## 样式定制

组件使用以下 CSS 类名，可通过 `className` 属性添加自定义类：

- `.tree-container` - 树容器
- `.tree-node` - 节点
- `.tree-node.selected` - 选中状态（高亮）
- `.tree-toggle` - 展开/折叠图标区域
- `.tree-icon` - 节点图标区域
- `.tree-title` - 节点标题
- `.context-menu` - 右键菜单
- `.menu-item` - 菜单项
- `.menu-item.disabled` - 禁用状态
- `.menu-item.danger` - 危险操作
- `.menu-divider` - 分隔线

## 文件结构

```
src/components/Tree/
├── Tree.tsx          # 主组件实现
├── Tree.types.ts     # TypeScript 类型定义
├── TreeNode.tsx      # 递归树节点组件
├── TreeView.tsx      # 树视图容器
├── ContextMenu.tsx   # 右键菜单组件
├── useTreeRef.ts     # ref 钩子
└── Tree.css          # 样式文件
```

## 关键设计说明

### 1. `isBranch` 字段
用于明确标识分支节点，解决了空分组无法判断的问题。即使 `children: []`，只要 `isBranch: true` 就会显示为可展开的分支节点。

### 2. 状态管理模式
采用组件内部状态模式，新打开 app 时所有节点默认折叠，用户使用时逐个展开。状态不持久化到 JSON 数据。

### 3. 回调式右键菜单
`onContextMenu(node, position) => MenuItem[]` 返回菜单配置数组，组件负责渲染菜单，点击时调用 `onItem(itemId, node)`。

### 4. 节点点击行为
- 点击分支节点：展开/折叠 + 触发 `onNodeClick`
- 点击叶子节点：选中 + 触发 `onNodeClick`
- 选中状态通过 `selectedId` 和 `onSelectedChange` 控制，与展开/折叠状态独立管理
