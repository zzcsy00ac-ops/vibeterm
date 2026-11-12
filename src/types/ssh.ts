/**
 * SSH 配置管理相关类型定义
 *
 * 基于 Tabby SSH 配置的调研结果
 */

// ==================== 核心数据类型 ====================

/**
 * SSH 配置文件类型
 */
export type SSHProfileType = 'ssh';

/**
 * 连接模式
 */
export type ConnectionMode =
  | 'direct'       // 直接连接
  | 'jumpHost'     // 跳板机
  | 'socksProxy'   // SOCKS 代理
  | 'httpProxy';   // HTTP 代理

/**
 * 认证方式
 */
export type AuthType =
  | 'auto'                  // 自动（尝试所有可用方式）
  | 'password'              // 密码认证
  | 'key'                   // 公钥认证
  | 'agent'                 // SSH Agent
  | 'keyboardInteractive';  // 键盘交互认证

// ==================== 分组类型 ====================

/**
 * SSH 分组
 *
 * 支持嵌套分组结构
 */
export interface SSHGroup {
  /** 唯一标识 */
  id: string;
  /** 分组名称 */
  name: string;
  /** 父分组 ID（null 表示顶级分组） */
  parentId: string | null;
  /** 子分组 ID 列表 */
  children: string[];
  /** 该分组下的 SSH 配置 ID 列表 */
  profiles: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ==================== SSH 配置类型 ====================

/**
 * SSH 连接配置
 *
 * 基于 Tabby 的 SSHProfile 结构
 */
export interface SSHProfile {
  // ========== 基础信息 ==========
  /** 唯一标识 */
  id: string;
  /** 类型标识 */
  type: SSHProfileType;
  /** 配置名称（必填，用于显示） */
  name: string;
  /** 所属分组 ID */
  groupId: string | null;
  /** 图标（可选，如 'server', 'database' 等） */
  icon?: string;

  // ========== 基础连接配置（General） ==========
  /** 连接模式 */
  connectionMode: ConnectionMode;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名（可选，留空则连接时询问） */
  username?: string;

  // ========== 认证配置 ==========
  /** 认证方式 */
  authType: AuthType;
  /** 密码是否已保存到 Keychain */
  hasPassword?: boolean;
  /** 私钥文件路径（密钥认证时使用） */
  privateKeyPath?: string;
  /** 私钥密码短语是否已保存到 Keychain */
  hasKeyPassphrase?: boolean;

  // ========== 高级选项（Advanced） ==========
  /** X11 转发 */
  x11?: boolean;
  /** Agent 转发 */
  agentForward?: boolean;
  /** 跳过欢迎消息 */
  skipBanner?: boolean;
  /** 会话复用（多标签页共享连接） */
  reuseSession?: boolean;
  /** 保活间隔（毫秒） */
  keepaliveInterval?: number;
  /** 最大保活次数 */
  keepaliveCountMax?: number;
  /** 就绪超时（毫秒） */
  readyTimeout?: number;

  // ========== 代理配置 ==========
  /** 跳板机 Profile ID */
  jumpHostId?: string;
  /** SOCKS 代理主机 */
  socksProxyHost?: string;
  /** SOCKS 代理端口 */
  socksProxyPort?: number;
  /** HTTP 代理主机 */
  httpProxyHost?: string;
  /** HTTP 代理端口 */
  httpProxyPort?: number;

  // ========== 元数据 ==========
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 最后连接时间 */
  lastConnectedAt?: number;
}

// ==================== 表单类型 ====================

/**
 * SSH 配置表单数据
 *
 * 用于创建/编辑 SSH 配置的表单
 */
export interface SSHProfileFormData {
  // 侧边栏字段
  name: string;
  groupId?: string;
  icon?: string;

  // General 标签页
  connectionMode: ConnectionMode;
  host: string;
  port: number;
  username?: string;
  authType: AuthType;
  hasPassword?: boolean;
  privateKeyPath?: string;
  hasKeyPassphrase?: boolean;

  // 高级选项
  x11?: boolean;
  agentForward?: boolean;
  skipBanner?: boolean;
  reuseSession?: boolean;
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
  readyTimeout?: number;

  // 代理配置
  jumpHostId?: string;
  socksProxyHost?: string;
  socksProxyPort?: number;
  httpProxyHost?: string;
  httpProxyPort?: number;
}

/**
 * 创建 SSH 配置的输入（不含 id 和时间戳）
 */
export type CreateSSHProfileInput = Omit<SSHProfile, 'id' | 'type' | 'createdAt' | 'updatedAt'>;

/**
 * 更新 SSH 配置的输入（所有字段可选）
 */
export type UpdateSSHProfileInput = Partial<Omit<SSHProfile, 'id' | 'type' | 'createdAt' | 'updatedAt'>>;

// ==================== 分组表单类型 ====================

/**
 * 分组表单数据
 */
export interface GroupFormData {
  /** 分组名称 */
  name: string;
  /** 父分组 ID（创建子分组时使用） */
  parentId?: string;
}

/**
 * 创建分组的输入
 */
export type CreateGroupInput = Omit<SSHGroup, 'id' | 'children' | 'profiles' | 'createdAt' | 'updatedAt'>;

// ==================== 树形结构类型 ====================

/**
 * 树形节点（用于侧边栏显示）
 */
export interface TreeNode {
  /** 节点 ID */
  id: string;
  /** 节点标题 */
  title: string;
  /** 是否为分支节点（可包含子节点） */
  isBranch?: boolean;
  /** 节点类型 */
  type: 'group' | 'profile' | 'root';
  /** 子节点 */
  children?: TreeNode[];
  /** 业务类型 */
  dataType?: 'ssh-group' | 'ssh-profile';
  /** 关联的 SSH 数据 */
  data?: SSHGroup | SSHProfile;
  /** 扩展字段 */
  [key: string]: any;
}

// ==================== Store 类型 ====================

/**
 * SSH Store 状态和方法
 */
export interface SSHStore {
  // ========== 状态 ==========
  /** 所有 SSH 配置 */
  profiles: SSHProfile[];
  /** 所有分组 */
  groups: SSHGroup[];

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
  getGroupTree: () => TreeNode;

  // ========== 查询 ==========
  /** 获取完整的树形结构（分组 + 配置） */
  getTree: () => TreeNode;
}
