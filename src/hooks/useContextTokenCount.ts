/**
 * useContextTokenCount - 计算上下文 Token 数量
 *
 * 使用字符估算方法计算聊天消息的 token 数量
 * 注意：这是估算值，实际 token 数可能会有差异
 */

import { useEffect, useState, useCallback } from 'react';

interface TokenCountResult {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UIMessageLike {
  role: string;
  content?: string;
  parts?: any[];
}

/**
 * 估算文本的 token 数量
 * 不同语言的 token/字符 比例不同：
 * - 英文：约 4 字符/token
 * - 中文：约 2-3 字符/token (汉字)
 * - 代码：约 3-4 字符/token
 */
function estimateTokens(text: string): number {
  // 统计中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 统计非中文字符数
  const nonChineseChars = text.length - chineseChars;

  // 中文约 2.5 字符/token，英文约 4 字符/token
  const chineseTokens = Math.ceil(chineseChars / 2.5);
  const nonChineseTokens = Math.ceil(nonChineseChars / 4);

  return chineseTokens + nonChineseTokens;
}

export function useContextTokenCount(
  messages: UIMessageLike[],
  _modelId?: string // 预留参数，未来可能用于根据模型调整估算
): TokenCountResult {
  const [tokenCount, setTokenCount] = useState<TokenCountResult>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });

  const calculateTokens = useCallback(() => {
    // 计算所有消息的 token 数（上下文）
    let promptTokens = 0;
    for (const msg of messages) {
      // 尝试从 parts 中获取文本内容
      let text = '';

      if (msg.parts && Array.isArray(msg.parts)) {
        // 从 parts 中提取文本
        const textParts = msg.parts.filter((p: any) => p.type === 'text');
        text = textParts.map((p: any) => p.text || '').join('\n');
      } else if (msg.content) {
        // 回退到 content 字段
        text = msg.content;
      }

      if (text) {
        // 每条消息的格式化开销（约 10 tokens）
        promptTokens += 10;

        // 估算内容的 token 数
        promptTokens += estimateTokens(text);
      }
    }

    // 添加回复的前缀开销（约 5 tokens）
    promptTokens += 5;

    const completionTokens = 0;
    const totalTokens = promptTokens + completionTokens;

    setTokenCount({
      promptTokens,
      completionTokens,
      totalTokens,
    });
  }, [messages]);

  useEffect(() => {
    calculateTokens();
  }, [calculateTokens]);

  return tokenCount;
}
