# ContextMenu 通用右键菜单组件

通用的右键菜单组件，支持两种使用模式：
1. **Radix UI 触发模式**：自动触发，适用于列表项、卡片等
2. **手动定位模式**：手动控制显示位置，适用于树形组件、画布等

## 安装

组件已内置在项目中，无需额外安装。

## 基础用法

### 模式 1: Radix UI 触发模式

适用于：列表项、卡片等需要右键菜单的场景

```tsx
import ContextMenu from '@/components/ContextMenu';
import { Download, Trash2 } from 'lucide-react';

function FileList() {
  const menuItems = [
    {
      key: 'download',
      label: '下载',
      icon: <Download size={14} />,
      onClick: () => console.log('下载'),
    },
    {
      key: 'delete',
      label: '删除',
      icon: <Trash2 size={14} />,
      danger: true,
      separator: true,
      onClick: () => console.log('删除'),
    },
  ];

  return (
    <ContextMenu items={menuItems}>
      <div>右键点击我</div>
    </ContextMenu>
  );
}
```

### 模式 2: 手动定位模式

适用于：树形组件、画布等已自定义右键处理的场景

```tsx
import { useState } from 'react';
import ContextMenu from '@/components/ContextMenu';

function TreeView() {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const menuItems = [
    {
      key: 'add',
      label: '添加',
      onClick: () => console.log('添加'),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => console.log('删除'),
    },
  ];

  return (
    <div onContextMenu={handleContextMenu}>
      <ContextMenu
        visible={showMenu}
        x={menuPos.x}
        y={menuPos.y}
        items={menuItems}
        onClose={() => setShowMenu(false)}
      />
    </div>
  );
}
```

## API

### ContextMenuItem

菜单项配置接口：

```typescript
interface ContextMenuItem {
  /** 唯一标识（用于 key） */
  key: string;

  /** 菜单项显示文本 */
  label: string;

  /** 可选图标（React 节点或 lucide-react 图标组件） */
  icon?: ReactNode;

  /** 快捷键提示（如 "Ctrl+C"） */
  shortcut?: string;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否危险操作（如删除，显示红色） */
  danger?: boolean;

  /** 在此项之前显示分隔线 */
  separator?: boolean;

  /** 点击回调 */
  onClick: () => void;

  /** 条件隐藏（当为 true 时不渲染此项） */
  hide?: boolean;
}
```

### ContextMenu Props

#### Radix UI 触发模式 Props

```typescript
interface ContextMenuTriggerProps {
  /** 菜单项配置数组 */
  items: ContextMenuItem[];

  /** 触发菜单的子元素 */
  children: ReactNode;

  /** 菜单与触发器的水平偏移 */
  alignOffset?: number;
}
```

#### 手动定位模式 Props

```typescript
interface ContextMenuPositionProps {
  /** 是否显示菜单 */
  visible: boolean;

  /** 菜单 X 坐标 */
  x: number;

  /** 菜单 Y 坐标 */
  y: number;

  /** 菜单项配置数组 */
  items: ContextMenuItem[];

  /** 关闭菜单回调 */
  onClose: () => void;

  /** 菜单与触发器的水平偏移 */
  alignOffset?: number;
}
```

## 高级用法

### 动态菜单项

根据条件显示不同的菜单项：

```tsx
const menuItems = [
  // 目录显示"打开"选项
  ...(file.isDirectory ? [{
    key: 'open',
    label: '打开',
    icon: <FolderOpen size={14} />,
    onClick: () => openFolder(file),
  }] : []),
  // 文件显示"下载"选项
  ...(!file.isDirectory ? [{
    key: 'download',
    label: '下载',
    icon: <Download size={14} />,
    onClick: () => downloadFile(file),
  }] : []),
  // 公共选项
  {
    key: 'delete',
    label: '删除',
    icon: <Trash2 size={14} />,
    danger: true,
    separator: true,
    onClick: () => deleteFile(file),
  },
];
```

### 带快捷键提示

```tsx
const menuItems = [
  {
    key: 'copy',
    label: '复制',
    shortcut: 'Ctrl+C',
    onClick: () => copy(),
  },
  {
    key: 'paste',
    label: '粘贴',
    shortcut: 'Ctrl+V',
    onClick: () => paste(),
  },
];
```

### 兼容 Tree 的 MenuItem

组件兼容 Tree 组件的 `MenuItem` 类型：

```typescript
// Tree 的 MenuItem 可以直接使用
const treeMenuItem = {
  id: 'delete',           // 兼容：映射到 key
  title: '删除',          // 兼容：映射到 label
  icon: <Trash2 />,
  danger: true,
  divider: true,          // 兼容：映射到 separator
  disabled: false,
  onClick: () => delete(),
};
```

## 迁移示例

### 从旧 SFTPContextMenu 迁移

**之前：**
```tsx
<SFTPContextMenu
  file={file}
  onDownload={handleDownload}
  onDelete={handleDelete}
>
  <SFTPFileItem file={file} />
</SFTPContextMenu>
```

**之后：**
```tsx
const menuItems = [
  {
    key: 'download',
    label: t('sftp.contextMenu.download'),
    icon: <Download size={14} />,
    onClick: () => handleDownload(file),
  },
  {
    key: 'delete',
    label: t('sftp.contextMenu.delete'),
    icon: <Trash2 size={14} />,
    danger: true,
    separator: true,
    onClick: () => handleDelete(file),
  },
];

<ContextMenu items={menuItems}>
  <SFTPFileItem file={file} />
</ContextMenu>
```

### 从旧 Tree ContextMenu 迁移

**之前：**
```tsx
<ContextMenu
  x={x}
  y={y}
  items={items}
  onItemClick={(item) => onItem(item.id, item.node)}
  onClose={closeMenu}
/>
```

**之后：**
```tsx
<ContextMenu
  visible={show}
  x={x}
  y={y}
  items={items.map(item => ({
    key: item.id,
    label: item.title,
    icon: item.icon,
    disabled: item.disabled,
    danger: item.danger,
    separator: item.divider,
    onClick: () => onItem(item.id, item.node),
  }))}
  onClose={closeMenu}
/>
```

## 样式定制

组件使用 CSS 变量适配主题，可以通过覆盖以下变量来定制样式：

```css
/* 菜单容器 */
.context-menu {
  --min-width: 180px;
  --background: var(--color-surface);
  --border: var(--color-border);
  --border-radius: 6px;
  --z-index: 99999;
}

/* 菜单项 */
.context-menu-item {
  --hover-bg: var(--color-surface-hover);
  --danger-color: var(--color-error);
  --danger-bg: var(--color-error-surface);
}
```

## 注意事项

1. **两种模式不能混用**：组件会根据 props 自动判断使用哪种模式
2. **手动定位模式**需要自己管理 `visible` 状态
3. **菜单项 key 必须唯一**：用于 React 的 key 渲染
4. **分隔线**会显示在菜单项之前
5. **danger 属性**会使菜单项显示为红色
