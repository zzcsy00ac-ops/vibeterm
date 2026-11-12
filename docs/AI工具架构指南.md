# AI 工具架构指南

本文档详细介绍项目中 AI Agent 工具系统的架构，以及如何添加新工具。

## 目录

- [架构概览](#架构概览)
- [核心概念](#核心概念)
- [添加新工具步骤](#添加新工具步骤)
- [工具实现示例](#工具实现示例)
- [配置说明](#配置说明)
- [工具审批机制](#工具审批机制)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 架构概览

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                      用户界面层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ToolSelector │  │ ChatInterface│  │ ApprovalCard │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────┐
│         │      服务层        │                  │              │
│  ┌──────▼───────┐  ┌───────▼──────────┐  ┌───▼──────────┐  │
│  │ agentService │  │  toolRegistry    │  │  chatStore   │  │
│  └──────┬───────┘  └───────┬──────────┘  └───────────────┘  │
│         │                  │                                  │
│  ┌──────▼──────────────────▼──────────┐                      │
│  │        工具定义层                    │                      │
│  │  ┌─────────┐ ┌─────────┐ ┌────────┐ │                      │
│  │  │ listSSH │  │execute  │  │calc... │ │                      │
│  │  │ Servers │  │Command  │  │getTime │ │                      │
│  │  └─────────┘ └─────────┘ └────────┘ │                      │
│  └──────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
          │                  │
┌─────────┼──────────────────┼──────────────────────────────────┐
│         │      后端层        │                                  │
│  ┌──────▼───────┐  ┌───────▼──────────┐                       │
│  │ Rust Tauri  │  │  外部 API/服务    │                       │
│  │   Commands  │  │                  │                       │
│  └─────────────┘  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/
├── services/
│   ├── tools/                    # 工具定义层
│   │   ├── index.ts              # 工具注册表（核心）
│   │   ├── calculateExpression.ts
│   │   ├── getCurrentTime.ts
│   │   └── [yourTool].ts        # 新工具文件
│   └── agentService.ts           # Agent 服务（集成工具）
│
├── components/
│   ├── ChatInterface/
│   │   └── ToolSelector/
│   │       ├── index.tsx         # 工具选择器组件
│   │       └── config.ts         # 工具配置和分组
│   └── ToolApprovalCard/
│       └── ToolApprovalCard.tsx  # 工具审批卡片
│
├── store/
│   └── chatStore.ts              # 聊天状态管理
│
└── types/
    └── provider.ts               # Provider 类型定义

public/locales/
├── cn/translation.json           # 中文翻译
├── en/translation.json           # 英文翻译
└── de/translation.json           # 德文翻译
```

---

## 核心概念

### 1. 工具 (Tool)

工具是 AI Agent 可以调用的函数，使用 Vercel AI SDK 的 `tool()` 函数定义：

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: '工具描述，告诉 AI 这个工具的作用',

  inputSchema: z.object({
    param1: z.string().describe('参数描述'),
    param2: z.number().optional().describe('可选参数'),
  }),

  execute: async ({ param1, param2 }) => {
    // 工具执行逻辑
    return { result: '...' };
  },
});
```

### 2. 工具注册表 (toolRegistry)

位于 `src/services/tools/index.ts`，集中管理所有工具：

```typescript
export const toolRegistry = {
  listSSHServers,
  executeCommand,
  calculateExpression,
  getCurrentTime,
  // 添加新工具
  myNewTool,
};

export type ToolName = keyof typeof toolRegistry;
```

### 3. 工具分组 (Tool Groups)

工具按功能分组，便于用户选择：

| 分组 ID | 描述 | 示例工具 |
|---------|------|----------|
| `ssh` | SSH 相关操作 | listSSHServers, executeCommand |
| `utility` | 实用工具 | calculateExpression |
| `system` | 系统操作 | getCurrentTime |

### 4. 工具审批 (needsApproval)

标记为需要用户审批的工具，执行前会显示确认卡片：

```typescript
export const executeCommand = tool({
  // ...
  needsApproval: true,  // 关键：需要用户确认
  // ...
});
```

### 5. Agent 集成

Agent 在创建时会接收启用的工具列表：

```typescript
const agent = new ToolLoopAgent({
  model: languageModel,
  tools: toolRegistry,
  activeTools: enabledTools,  // 用户选择的工具
  toolChoice: 'auto',
});
```

---

## 添加新工具步骤

### 步骤 1: 创建工具文件

在 `src/services/tools/` 下创建新文件：

```bash
# 命名规范：使用 camelCase
src/services/tools/myNewTool.ts
```

### 步骤 2: 实现工具函数

```typescript
/**
 * AI 工具：[工具功能描述]
 *
 * [详细说明工具的用途和特性]
 */

import { tool } from 'ai';
import { z } from 'zod';

export const myNewTool = tool({
  description: `工具功能描述。
  使用场景：
  - 场景1
  - 场景2`,

  inputSchema: z.object({
    requiredParam: z.string().describe('必需参数描述'),
    optionalParam: z.string().optional().describe('可选参数描述'),
  }),

  execute: async ({ requiredParam, optionalParam }) => {
    // 实现工具逻辑

    // 返回值必须是可序列化的纯数据
    // 不能包含函数、Symbol 等
    return {
      result: '...',
      data: { /* ... */ },
    };
  },
});
```

### 步骤 3: 注册工具

在 `src/services/tools/index.ts` 中：

```typescript
// 1. 导入工具
import { myNewTool } from './myNewTool';

// 2. 添加到注册表
export const toolRegistry = {
  listSSHServers,
  executeCommand,
  calculateExpression,
  getCurrentTime,
  myNewTool,  // 新增
};

// ToolName 类型会自动更新
```

### 步骤 4: 配置工具元数据

在 `src/components/ChatInterface/ToolSelector/config.ts` 中：

```typescript
export const TOOL_ITEMS_CONFIG: Record<ToolName, Omit<MultiSelectItem, 'value'>> = {
  // ... 现有工具
  myNewTool: {
    label: 'tool.myNewTool.name',
    description: 'tool.myNewTool.description',
    group: 'utility',  // 选择合适的分组
  },
};
```

### 步骤 5: 添加国际化翻译

在 `public/locales/*/translation.json` 中：

**中文 (cn)**:
```json
{
  "tool": {
    "myNewTool": {
      "name": "我的新工具",
      "description": "工具功能描述"
    }
  }
}
```

**英文 (en)**:
```json
{
  "tool": {
    "myNewTool": {
      "name": "My New Tool",
      "description": "Tool description"
    }
  }
}
```

**德文 (de)**:
```json
{
  "tool": {
    "myNewTool": {
      "name": "Mein Neues Werkzeug",
      "description": "Werkzeugbeschreibung"
    }
  }
}
```

### 步骤 6: 测试

1. 启动应用：`pnpm tauri dev`
2. 打开聊天界面
3. 点击工具选择器
4. 确认新工具出现在列表中
5. 启用工具并测试 AI 调用

---

## 工具实现示例

### 示例 1: 简单计算工具 (无外部依赖)

```typescript
// src/services/tools/calculateExpression.ts
import { tool } from 'ai';
import { z } from 'zod';
import { evaluate } from 'mathjs';

export const calculateExpression = tool({
  description: '计算数学表达式的值。支持基本运算（+, -, *, /）、括号、指数(^)、三角函数等',

  inputSchema: z.object({
    expression: z.string().describe('要计算的数学表达式，例如: "2 + 3 * 4"'),
  }),

  execute: async ({ expression }) => {
    try {
      const result = evaluate(expression);
      return {
        expression,
        result: typeof result === 'number' ? parseFloat(result.toFixed(10)) : result,
        success: true,
      };
    } catch (error) {
      return {
        expression,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  },
});
```

### 示例 2: 时区感知工具 (使用标准 API)

```typescript
// src/services/tools/getCurrentTime.ts
import { tool } from 'ai';
import { z } from 'zod';

export const getCurrentTime = tool({
  description: '获取当前的日期和时间，支持时区转换',

  inputSchema: z.object({
    timezone: z.string().optional()
      .describe('时区标识符（如 "Asia/Shanghai"、"UTC"）'),
    format: z.enum(['iso', 'readable', 'full']).optional()
      .describe('返回格式'),
  }),

  execute: async ({ timezone, format = 'full' }) => {
    const now = new Date();
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      iso: now.toISOString(),
      unixTimestamp: now.getTime(),
      readable: now.toLocaleString('zh-CN'),
      timezone: timezone || systemTimezone,
    };
  },
});
```

### 示例 3: 需要审批的工具 (敏感操作)

```typescript
// src/services/tools/executeCommand.ts
import { tool } from 'ai';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';

export const executeCommand = tool({
  description: '在远程服务器执行 shell 命令',

  inputSchema: z.object({
    serverId: z.string().describe('SSH 配置 ID'),
    command: z.string().describe('要执行的命令'),
    reason: z.string().describe('执行理由'),
  }),

  needsApproval: true,  // 关键：需要用户确认

  execute: async ({ serverId, command, reason }) => {
    // 调用后端执行
    const result = await invoke('tool_execute_command', {
      sessionId: serverId,
      command,
    });

    return result;
  },
});
```

### 示例 4: 使用 Store 数据的工具

```typescript
// src/services/tools/listSSHServers.ts
import { tool } from 'ai';
import { z } from 'zod';

export const listSSHServers = tool({
  description: '查询用户已配置的 SSH 服务器列表',

  inputSchema: z.object({
    filter: z.string().optional().describe('过滤条件'),
  }),

  execute: async ({ filter }) => {
    // 动态导入 Store（避免循环依赖）
    const { useSSHStore } = await import('../../store/sshStore');

    // 等待 Store 数据加载
    let profiles = useSSHStore.getState().profiles;
    const state = useSSHStore.getState();
    if (!state._hydrated) {
      await new Promise(resolve => setTimeout(resolve, 100));
      profiles = useSSHStore.getState().profiles;
    }

    // 应用过滤
    let filteredProfiles = profiles;
    if (filter) {
      filteredProfiles = profiles.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return {
      servers: filteredProfiles.map(p => ({
        id: p.id,
        name: p.name,
        host: p.host,
      })),
      total: filteredProfiles.length,
    };
  },
});
```

---

## 配置说明

### 工具配置结构

```typescript
// src/components/ChatInterface/ToolSelector/config.ts

export const TOOL_GROUPS: MultiSelectGroup[] = [
  {
    id: 'ssh',
    label: 'tool.group.ssh',
    description: 'tool.group.ssh.description',
  },
  // 添加新分组（如需要）
];

export const TOOL_ITEMS_CONFIG: Record<ToolName, Omit<MultiSelectItem, 'value'>> = {
  myTool: {
    label: 'tool.myTool.name',      // i18n key
    description: 'tool.myTool.description',  // i18n key
    group: 'ssh',                   // 所属分组
  },
};
```

### 新增分组步骤

1. 在 `TOOL_GROUPS` 中添加分组定义
2. 在翻译文件中添加分组翻译
3. 在工具配置中使用新分组 ID

```typescript
// 添加新分组
{
  id: 'network',
  label: 'tool.group.network',
  description: 'tool.group.network.description',
}
```

```json
// 翻译文件
{
  "tool": {
    "group": {
      "network": "网络操作",
      "network.description": "网络相关功能和诊断"
    }
  }
}
```

---

## 工具审批机制

### 审批流程

```
┌─────────────┐
│ AI 调用工具  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ needsApproval?  │
└────┬────────────┘
     │
     ├─ No ──► 直接执行
     │
     └─ Yes ──► ┌──────────────────┐
                │ 显示审批卡片      │
                │ ToolApprovalCard  │
                └─────┬────────────┘
                      │
         ┌────────────┼────────────┐
         │                        │
         ▼                        ▼
   ┌─────────┐              ┌─────────┐
   │ 用户同意 │              │ 用户拒绝 │
   └────┬────┘              └────┬────┘
        │                        │
        ▼                        ▼
   ┌─────────┐              ┌─────────┐
   │ 执行工具 │              │ 返回拒绝 │
   └─────────┘              └─────────┘
```

### 启用审批

在工具定义中添加 `needsApproval: true`：

```typescript
export const sensitiveTool = tool({
  // ...
  needsApproval: true,  // 启用审批
  // ...
});
```

### 审批卡片状态

| 状态 | 说明 | UI 展示 |
|------|------|---------|
| `approval-requested` | 等待用户确认 | 显示确认/拒绝按钮 |
| `output-available` | 执行完成 | 显示执行结果 |
| `execution-failed` | 执行失败 | 显示错误信息 |

---

## 最佳实践

### 1. 工具命名规范

```typescript
// ✅ 推荐：使用 camelCase，描述性命名
export const listSSHServers = tool({ ... });
export const calculateExpression = tool({ ... });
export const getCurrentTime = tool({ ... });

// ❌ 避免：缩写或不清晰
export const lst = tool({ ... });
export const calc = tool({ ... });
```

### 2. 描述编写规范

```typescript
// ✅ 推荐：详细描述使用场景
description: `获取当前的日期和时间。
返回信息包括：
- ISO 格式时间戳
- Unix 时间戳
- 结构化的年月日时分秒

使用场景：
- 回答"现在几点了"
- 计算"距离某天还有多少天"
- 生成带时间戳的日志`

// ❌ 避免：描述过于简单
description: '获取时间'
```

### 3. 参数设计规范

```typescript
// ✅ 推荐：清晰的参数描述和验证
inputSchema: z.object({
  serverId: z.string().describe('SSH 配置 ID（可通过 listSSHServers 获取）'),
  command: z.string().describe('要执行的 shell 命令'),
  maxWaitTime: z.number().optional().describe('最长等待时间（秒），默认 30 秒'),
}),

// ❌ 避免：缺少描述
inputSchema: z.object({
  serverId: z.string(),
  command: z.string(),
}),
```

### 4. 返回值规范

```typescript
// ✅ 推荐：返回可序列化的纯数据
execute: async ({ param }) => {
  return {
    result: 'success',
    data: { /* 纯对象 */ },
    timestamp: Date.now(),
  };
}

// ❌ 避免：返回函数或不可序列化对象
execute: async ({ param }) => {
  return {
    result: 'success',
    callback: () => {},  // 错误：函数不能序列化
    symbol: Symbol('test'),  // 错误：Symbol 不能序列化
  };
}
```

### 5. 错误处理规范

```typescript
// ✅ 推荐：友好的错误提示
execute: async ({ param }) => {
  try {
    const result = await someOperation();
    return result;
  } catch (error) {
    return {
      error: `操作失败: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

// ❌ 避免：直接抛出错误
execute: async ({ param }) => {
  const result = await someOperation();
  return result;  // 如果失败会抛出未捕获的异常
}
```

### 6. 依赖注入规范

```typescript
// ✅ 推荐：动态导入 Store
execute: async ({ param }) => {
  const { useSSHStore } = await import('../../store/sshStore');
  const profiles = useSSHStore.getState().profiles;
  // ...
}

// ❌ 避免：顶部静态导入（可能导致循环依赖）
import { useSSHStore } from '../../store/sshStore';
export const myTool = tool({
  execute: async () => {
    const profiles = useSSHStore.getState().profiles;
  }
});
```

### 7. 工具分组规范

```typescript
// ✅ 推荐：按功能域分组
'ssh'      - SSH 相关操作
'utility'  - 通用实用工具
'system'   - 系统级操作
'network'  - 网络相关功能

// ❌ 避免：过于细分或逻辑不清
'calc-tools'   - 过于具体
'misc'         - 不明确
```

---

## 故障排查

### 问题 1: 工具不出现在选择器中

**可能原因**：
- 工具未添加到 `toolRegistry`
- 工具未添加到 `TOOL_ITEMS_CONFIG`
- TypeScript 类型错误

**排查步骤**：
```typescript
// 1. 检查注册表
console.log(Object.keys(toolRegistry));  // 应包含你的工具

// 2. 检查配置
console.log(TOOL_ITEMS_CONFIG['myTool']);  // 应该有配置

// 3. 检查类型
type Test = ToolName;  // 应包含你的工具名称
```

### 问题 2: AI 不调用工具

**可能原因**：
- 工具描述不够清晰
- 参数定义有问题
- 工具未启用

**解决方法**：
1. 改进工具描述，明确使用场景
2. 检查 `inputSchema` 参数是否正确
3. 确认用户在工具选择器中启用了该工具

### 问题 3: 工具返回 "The Object can not be cloned"

**原因**：返回值包含不可序列化的对象（函数、Symbol 等）

**解决**：
```typescript
// ❌ 错误
return {
  fn: () => {},  // 函数
  sym: Symbol(),  // Symbol
};

// ✅ 正确
return {
  value: 'data',
  timestamp: Date.now(),
};
```

### 问题 4: 审批不显示

**原因**：缺少 `needsApproval: true`

**解决**：
```typescript
export const myTool = tool({
  needsApproval: true,  // 添加此行
  // ...
});
```

### 问题 5: 翻译不显示

**可能原因**：
- i18n key 不匹配
- 翻译文件未保存
- 缺少语言版本

**排查**：
```typescript
// 检查 key 是否正确
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
console.log(t('tool.myTool.name'));  // 应该显示翻译
```

---

## 快速参考

### 工具模板

```typescript
/**
 * AI 工具：[功能描述]
 */

import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: `工具功能描述。
  使用场景：
  - 场景1
  - 场景2`,

  inputSchema: z.object({
    param: z.string().describe('参数描述'),
  }),

  execute: async ({ param }) => {
    try {
      // 工具逻辑
      return { result: 'success' };
    } catch (error) {
      return {
        error: String(error),
        success: false,
      };
    }
  },
});
```

### 检查清单

添加新工具时，确保完成：

- [ ] 创建工具文件
- [ ] 实现工具函数
- [ ] 添加到 `toolRegistry`
- [ ] 添加到 `TOOL_ITEMS_CONFIG`
- [ ] 添加中文翻译
- [ ] 添加英文翻译
- [ ] 添加德文翻译
- [ ] 测试工具调用
- [ ] 测试错误处理

---

## 相关资源

### 官方文档
- [Vercel AI SDK - Tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools)
- [Zod - Schema Validation](https://zod.dev/)
- [Radix UI - Themes](https://www.radix-ui.com/themes)
- [i18next - Framework](https://www.i18next.com/)

### 项目文件
- 工具注册表：`src/services/tools/index.ts`
- Agent 服务：`src/services/agentService.ts`
- 工具配置：`src/components/ChatInterface/ToolSelector/config.ts`
- 翻译文件：`public/locales/*/translation.json`

---

*文档更新日期: 2026-01-24*
