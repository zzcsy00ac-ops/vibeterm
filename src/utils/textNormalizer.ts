/**
 * 文本规范化工具 - 修复 AI 流式响应中的换行符丢失问题
 *
 * 问题描述: 某些 AI 模型（如 Claude 3.7）在流式响应时不会自动添加换行符
 * 导致 Markdown 内容（特别是代码块）渲染为单行
 *
 * 解决方案: 在渲染前对文本进行规范化，确保 Markdown 元素前有适当的换行
 *
 * 参考:
 * - https://github.com/vercel/ai/issues/6630
 * - https://github.com/fern-api/fern-platform/pull/2869/files
 */

/**
 * 规范化单个 Markdown 文本
 *
 * 在代码块前添加适当的换行符，修复 AI 流式响应中的换行符丢失问题
 *
 * @param text - 原始 Markdown 文本
 * @returns 规范化后的文本
 */
export function normalizeMarkdownText(text: string): string {
  if (!text) return text;

  let normalized = text;

  // 1. 确保代码块开始标签前有两个换行
  // 例如: "Text```python" -> "Text\n\n```python"
  normalized = normalized.replace(/([^\n])(```)/g, '$1\n\n$2');

  // 2. 确保代码块结束标签后有两个换行
  // 例如: "```\nNext" -> "```\n\nNext"
  normalized = normalized.replace(/(```)$([^\n])/gm, '$1\n\n$2');

  // 3. 修复连续代码块之间缺少换行的问题
  // 例如: "```\n```" -> "```\n\n```"
  normalized = normalized.replace(/```\n```/g, '```\n\n```');

  // 4. 压缩过多的空行（3个或更多换行符压缩为2个）
  // 避免出现过多的空白
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized;
}

/**
 * 规范化消息数组中的 text parts
 *
 * 遍历消息数组，对每个消息中的 text 类型的 part 进行规范化处理
 *
 * @param messages - 消息数组
 * @returns 规范化后的消息数组
 */
export function normalizeMessageParts<
  T extends { parts?: Array<{ type: string; text?: string }> }
>(messages: T[]): T[] {
  return messages.map((message) => {
    if (!message.parts) return message;

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.type === 'text' && part.text) {
          return {
            ...part,
            text: normalizeMarkdownText(part.text),
          };
        }
        return part;
      }),
    };
  });
}

/**
 * 规范化单个消息
 *
 * 对单个消息中的 text parts 进行规范化处理
 *
 * @param message - 单个消息对象
 * @returns 规范化后的消息
 */
export function normalizeSingleMessage<
  T extends { parts?: Array<{ type: string; text?: string }> }
>(message: T): T {
  if (!message.parts) return message;

  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type === 'text' && part.text) {
        return {
          ...part,
          text: normalizeMarkdownText(part.text),
        };
      }
      return part;
    }),
  };
}
