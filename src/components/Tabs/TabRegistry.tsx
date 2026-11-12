/**
 * 标签页组件注册表
 *
 * 核心思想：Tab 类似路由，只描述"显示什么"，不包含实际组件
 * - Tab.key: 标识要显示的视图类型（如 'ssh', 'chat'）
 * - Tab.params: 传递给组件的参数
 * - TAB_REGISTRY: 维护 key → 组件的映射关系
 *
 * 优势：
 * - 完全可序列化，所有字段都可持久化
 * - 应用重启后标签内容自动恢复
 * - 解耦状态管理和UI渲染
 */

// ==================== 类型定义 ====================

/**
 * 标签页视图参数类型
 *
 * 每个 key 对应的 params 类型：
 * - 'ssh': { session: TreeNode } - SSH 会话（已弃用）
 * - 'terminal': { sessionId?: string; title?: string } - 通用终端（已弃用）
 * - 'ssh-terminal': { sessionId: string; host: string; port: number; username: string; password?: string; privateKeyPath?: string; savePassword?: boolean } - SSH 终端
 * - 'chat': { chatId: string; ephemeralProviderId?: string; ephemeralModelId?: string } - 聊天窗口
 * - etc.
 */
export interface TabParams {
  ssh?: { session: any };
  chat?: { chatId: string; ephemeralProviderId?: string; ephemeralModelId?: string };
  terminal?: { sessionId?: string; title?: string };
  'ssh-terminal'?: {
    sessionId: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    savePassword?: boolean;
  };
  [key: string]: any;
}

/**
 * 标签页视图 Key 类型
 */
export type TabKey = 'ssh' | 'chat' | 'terminal' | 'ssh-terminal' | string;

/**
 * 可注册的组件类型
 */
export type TabComponent = React.ComponentType<any>;

// ==================== 组件注册表 ====================

/**
 * 标签页组件注册表
 *
 * 用法示例：
 * ```tsx
 * // 打开标签
 * addTab({
 *   title: 'SSH Terminal',
 *   key: 'terminal',
 *   params: { sessionId: 'session-123', title: 'My Server' }
 * });
 *
 * // 渲染组件
 * const Component = TAB_REGISTRY[tab.key];
 * <Component {...tab.params} />
 * ```
 */

// 导入组件
import { XtermTerminal } from '../XtermTerminal/XtermTerminal';
import { SSHTerminal } from '../SSHTerminal';
import { ChatInterface } from '../ChatInterface/ChatInterface';

export const TAB_REGISTRY: Record<string, TabComponent> = {
  // SSH 终端组件（已弃用，保留用于兼容）
  terminal: XtermTerminal,

  // SSH 终端组件（真实 SSH 连接）
  'ssh-terminal': SSHTerminal,

  // 聊天窗口组件
  chat: ChatInterface,
};

/**
 * 检查 key 是否已注册
 */
export function isTabKeyRegistered(key: string): key is TabKey {
  return key in TAB_REGISTRY;
}

/**
 * 获取注册的组件
 */
export function getTabComponent(key: TabKey): TabComponent | null {
  return TAB_REGISTRY[key] || null;
}
