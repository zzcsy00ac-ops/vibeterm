/**
 * 工具调用辅助函数
 *
 * 提供工具调用状态检测、错误处理和日志记录功能
 * 用于解决流式响应中工具调用卡在 input-streaming 状态的问题
 */

/**
 * 未完成工具调用的信息
 */
export interface IncompleteToolInfo {
  /** 工具类型 */
  toolType: string;
  /** 工具调用 ID */
  toolCallId: string;
  /** 工具输入参数（可能不完整） */
  input?: any;
  /** 当前状态 */
  state: string;
}

/**
 * UIMessage 的 Part 类型定义（简化版）
 */
interface UIMessagePart {
  type: string;
  toolType?: string;
  toolCallId?: string;
  state?: string;
  input?: any;
  [key: string]: any;
}

/**
 * UIMessage 类型定义（简化版）
 */
interface UIMessage {
  id: string;
  role: string;
  parts?: UIMessagePart[];
}

/**
 * 检测消息列表中未完成的工具调用
 *
 * @param messages - UIMessage 数组
 * @returns 未完成工具调用的信息数组
 *
 * @example
 * ```ts
 * const incompleteTools = detectIncompleteToolCalls(messages);
 * if (incompleteTools.length > 0) {
 *   console.warn('发现未完成的工具调用:', incompleteTools);
 * }
 * ```
 */
export function detectIncompleteToolCalls(messages: UIMessage[]): IncompleteToolInfo[] {
  const incompleteTools: IncompleteToolInfo[] = [];

  for (const message of messages) {
    if (!message.parts) continue;

    for (const part of message.parts) {
      // 检测工具类型的 part，且状态为 input-streaming
      if (
        part.type?.startsWith('tool-') &&
        part.state === 'input-streaming'
      ) {
        console.error('有问题的message',message)
        incompleteTools.push({
          toolType: part.toolType || 'unknown',
          toolCallId: part.toolCallId || 'unknown',
          input: part.input,
          state: part.state,
        });
      }
    }
  }

  return incompleteTools;
}

/**
 * 格式化工具错误消息
 *
 * 生成用户友好的错误提示文本
 *
 * @param tool - 未完成工具的信息
 * @param t - 可选的 i18n 翻译函数
 * @returns 格式化的错误消息
 *
 * @example
 * ```ts
 * // 不使用 i18n
 * const msg = formatToolErrorMessage(tool);
 * // => "工具调用 executeCommand 未完成，请重试"
 *
 * // 使用 i18n
 * const msg = formatToolErrorMessage(tool, t);
 * // => "Tool call executeCommand incomplete. Please retry."
 * ```
 */
export function formatToolErrorMessage(
  tool: IncompleteToolInfo,
  t?: any // i18next TFunction 类型太复杂，使用 any
): string {
  const toolName = tool.toolType;

  if (t) {
    try {
      // 使用 i18n 翻译
      return t('chat.toolErrors.incompleteTool', { toolType: toolName });
    } catch {
      // 翻译失败，使用默认文本
    }
  }

  // 默认中文提示
  return `工具调用 "${toolName}" 未完成，请重试`;
}

/**
 * 记录未完成工具调用的日志
 *
 * 输出到控制台，并预留 Sentry 集成接口
 *
 * @param tools - 未完成工具的信息数组
 * @param chatId - 可选的聊天会话 ID
 *
 * @example
 * ```ts
 * logIncompleteTools(incompleteTools, 'chat-123');
 * // 控制台输出：
 * // [ToolCallHelper] 检测到 2 个未完成的工具调用 (chatId: chat-123)
 * // [ToolCallHelper]   - executeCommand (id: tool-abc)
 * // [ToolCallHelper]   - listSSHServers (id: tool-def)
 * ```
 */
export function logIncompleteTools(
  tools: IncompleteToolInfo[],
  chatId?: string
): void {
  if (tools.length === 0) return;

  const context = chatId ? ` (chatId: ${chatId})` : '';

  console.warn(
    `[ToolCallHelper] 检测到 ${tools.length} 个未完成的工具调用${context}`
  );

  tools.forEach((tool, index) => {
    console.warn(
      `[ToolCallHelper]   ${index + 1}. ${tool.toolType} (id: ${tool.toolCallId}, state: ${tool.state})`
    );
  });

  // TODO: 集成 Sentry 错误监控
  // if (typeof Sentry !== 'undefined') {
  //   Sentry.captureMessage('Incomplete tool calls detected', {
  //     level: 'warning',
  //     extra: {
  //       toolCount: tools.length,
  //       chatId,
  //       tools: tools.map(t => ({
  //         type: t.toolType,
  //         id: t.toolCallId,
  //         state: t.state,
  //       })),
  //     },
  //   });
  // }
}

/**
 * 生成工具调用超时错误消息
 *
 * @param toolType - 工具类型
 * @param t - 可选的 i18n 翻译函数
 * @returns 格式化的超时错误消息
 */
export function formatToolTimeoutMessage(
  toolType: string,
  t?: (key: string) => string
): string {
  if (t) {
    try {
      // @ts-ignore - i18next 类型系统的限制
      return t('chat.toolErrors.timeout', { toolType });
    } catch {
      // 翻译失败，使用默认文本
    }
  }

  return `工具调用 "${toolType}" 超时`;
}

/**
 * 工具调用状态枚举
 */
export const ToolCallState = {
  /** 正在接收输入参数 */
  INPUT_STREAMING: 'input-streaming',
  /** 等待用户审批 */
  APPROVAL_REQUIRED: 'approval-required',
  /** 输出可用 */
  OUTPUT_AVAILABLE: 'output-available',
  /** 执行失败 */
  EXECUTION_FAILED: 'execution-failed',
} as const;

/**
 * 检查工具调用是否处于可完成状态
 *
 * @param state - 工具调用状态
 * @returns 是否可完成
 */
export function isToolComplete(state: string): boolean {
  return (
    state === ToolCallState.OUTPUT_AVAILABLE ||
    state === ToolCallState.EXECUTION_FAILED
  );
}

/**
 * 检查工具调用是否处于活跃状态
 *
 * @param state - 工具调用状态
 * @returns 是否活跃
 */
export function isToolActive(state: string): boolean {
  return (
    state === ToolCallState.INPUT_STREAMING ||
    state === ToolCallState.APPROVAL_REQUIRED
  );
}
