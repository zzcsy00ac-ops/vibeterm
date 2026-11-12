# Dialog 通用对话框组件

通用的对话框组件，通过 ref 方法调用（命令式 API），支持确认、提示、输入三种模式。

**核心特性**：
- 命令式 API：通过 `dialogRef.current.confirm()` 等方法调用
- 自动挂载到 `.app-container`：避免父容器 `transform` 样式导致的 `position:fixed` 失效问题
- 支持自定义内容：可通过 `content` 属性传入自定义 ReactNode

## 安装

组件已内置在项目中，无需额外安装。

## 基础用法

### 1. 引入组件并创建 ref

```tsx
import { useRef } from 'react';
import { Dialog, type DialogRef } from '@/components/Dialog';

function MyComponent() {
  const dialogRef = useRef<DialogRef>(null);

  return (
    <div>
      {/* 组件内容 */}
      <Dialog ref={dialogRef} />
    </div>
  );
}
```

### 2. 确认对话框（confirm）

```tsx
const handleDelete = (file: SFTPFile) => {
  dialogRef.current?.confirm({
    title: '确认删除',
    message: `确定要删除 "${file.name}" 吗？此操作无法撤销。`,
    confirmText: '删除',
    cancelText: '取消',
    type: 'danger',
    onConfirm: () => {
      // 执行删除操作
      deleteFile(file);
    },
  });
};
```

### 3. 提示对话框（alert）

```tsx
const handleAlert = () => {
  dialogRef.current?.alert({
    title: '操作成功',
    message: '文件已上传完成',
    buttonText: '确定',
  });
};
```

### 4. 输入对话框（prompt）

```tsx
const handleCreateFolder = () => {
  dialogRef.current?.prompt({
    title: '创建文件夹',
    message: '请输入文件夹名称：',
    placeholder: '新建文件夹',
    defaultValue: '',
    confirmText: '创建',
    cancelText: '取消',
    onConfirm: (value) => {
      // value 是用户输入的值
      createDirectory(value);
    },
  });
};
```

## API

### DialogRef

通过 ref 暴露的方法：

```typescript
interface DialogRef {
  /** 确认对话框（有确认和取消按钮） */
  confirm: (options: ConfirmOptions) => void;

  /** 提示对话框（只有一个确认按钮） */
  alert: (options: AlertOptions) => void;

  /** 输入对话框（有输入框和确认/取消按钮） */
  prompt: (options: PromptOptions) => void;
}
```

### ConfirmOptions

确认对话框配置：

```typescript
interface ConfirmOptions {
  /** 标题 */
  title: string;

  /** 消息内容（可选，使用 content 时会覆盖此值） */
  message?: string;

  /** 自定义内容（ReactNode，会覆盖 message） */
  content?: ReactNode;

  /** 确认按钮文字（默认："确认"） */
  confirmText?: string;

  /** 取消按钮文字（默认："取消"） */
  cancelText?: string;

  /** 对话框类型（默认："default"） */
  type?: 'default' | 'danger' | 'warning';

  /** 确认回调 */
  onConfirm?: () => void;

  /** 取消回调 */
  onCancel?: () => void;
}
```

### AlertOptions

提示对话框配置：

```typescript
interface AlertOptions {
  /** 标题 */
  title: string;

  /** 消息内容（可选） */
  message?: string;

  /** 自定义内容（ReactNode） */
  content?: ReactNode;

  /** 按钮文字（默认："确定"） */
  buttonText?: string;

  /** 按钮点击回调 */
  onButtonClick?: () => void;
}
```

### PromptOptions

输入对话框配置：

```typescript
interface PromptOptions {
  /** 标题 */
  title: string;

  /** 消息内容（可选） */
  message?: string;

  /** 自定义内容（ReactNode） */
  content?: ReactNode;

  /** 输入框占位符 */
  placeholder?: string;

  /** 输入框默认值 */
  defaultValue?: string;

  /** 确认按钮文字（默认："确认"） */
  confirmText?: string;

  /** 取消按钮文字（默认："取消"） */
  cancelText?: string;

  /** 确认回调，参数为用户输入的值 */
  onConfirm?: (value: string) => void;

  /** 取消回调 */
  onCancel?: () => void;
}
```

## 高级用法

### 自定义内容

使用 `content` 属性传入自定义 ReactNode：

```tsx
dialogRef.current?.confirm({
  title: '确认删除',
  content: (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <AlertTriangle size={48} style={{ color: 'var(--color-error)', marginBottom: '12px' }} />
      <p style={{ fontSize: '14px', marginBottom: '4px' }}>
        确定要删除这个文件吗？
      </p>
      <p style={{ fontSize: '13px', color: 'var(--gray-10)' }}>
        此操作无法撤销
      </p>
    </div>
  ),
  confirmText: '删除',
  type: 'danger',
  onConfirm: () => deleteFile(),
});
```

### 不同类型的对话框

```tsx
// 默认类型（蓝色确认按钮）
dialogRef.current?.confirm({
  title: '确认操作',
  message: '是否继续？',
  type: 'default',
});

// 危险类型（红色确认按钮）
dialogRef.current?.confirm({
  title: '确认删除',
  message: '此操作无法撤销！',
  type: 'danger',
});

// 警告类型（橙色确认按钮）
dialogRef.current?.confirm({
  title: '警告',
  message: '检测到潜在风险',
  type: 'warning',
});
```

## 样式定制

组件使用 CSS 变量适配主题，可以通过覆盖以下变量来定制样式：

```css
/* 遮罩层 */
.dialog-overlay {
  --background: rgba(0, 0, 0, 0.5);
  --blur: 2px;
}

/* 对话框内容 */
.dialog-content {
  --min-width: 320px;
  --max-width: 480px;
  --background: var(--color-surface);
  --border: var(--color-border);
  --border-radius: 8px;
}

/* 按钮 */
.dialog-button--confirm.dialog-button--danger {
  --background: var(--color-error);
}
```

## 迁移示例

### 从 DeleteConfirmDialog 迁移

**之前：**
```tsx
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [fileToDelete, setFileToDelete] = useState<SFTPFile | null>(null);

const handleDelete = (file: SFTPFile) => {
  setFileToDelete(file);
  setDeleteDialogOpen(true);
};

return (
  <>
    {/* ... */}
    <DeleteConfirmDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      file={fileToDelete}
      onConfirm={handleConfirmDelete}
    />
  </>
);
```

**之后：**
```tsx
const dialogRef = useRef<DialogRef>(null);

const handleDelete = (file: SFTPFile) => {
  dialogRef.current?.confirm({
    title: '确认删除',
    message: `确定要删除 "${file.name}" 吗？`,
    type: 'danger',
    onConfirm: () => handleConfirmDelete(file),
  });
};

return (
  <>
    {/* ... */}
    <Dialog ref={dialogRef} />
  </>
);
```

## 注意事项

1. **Dialog 只需放置一次**：在组件中只需放置一个 `<Dialog ref={dialogRef} />`，可以多次调用 `confirm()`、`alert()`、`prompt()`
2. **自动挂载**：组件会自动挂载到 `.app-container`，无需手动指定 Portal 容器
3. **ref 可能为 null**：使用 `dialogRef.current?.confirm()` 的可选链语法避免 null 错误
4. **输入框自动聚焦**：`prompt()` 模式下，输入框会自动获得焦点
5. **回车提交**：`prompt()` 模式下，按回车键会触发确认操作
