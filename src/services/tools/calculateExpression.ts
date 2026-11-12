/**
 * AI 工具：计算表达式
 *
 * 使用 math.js 库实现安全的数学表达式计算
 * 弥补大语言模型在算术计算方面的短板
 */

import { tool } from 'ai';
import { z } from 'zod';
import { evaluate } from 'mathjs';

/**
 * 工具：计算数学表达式
 *
 * 支持的功能：
 * - 基本运算：+, -, *, /
 * - 括号：( )
 * - 指数：^ 或 pow(x, y)
 * - 三角函数：sin, cos, tan
 * - 对数：log, log10
 * - 常量：PI, E
 * - 平方根：sqrt
 *
 * @example
 * "2 + 3 * 4" → 14
 * "(2 + 3) * 4" → 20
 * "2^10" → 1024
 * "sin(PI/2)" → 1
 * "sqrt(16)" → 4
 */
export const calculateExpression = tool({
  description: '计算数学表达式的值。支持基本运算（+, -, *, /）、括号、指数(^)、三角函数(sin, cos, tan)、对数(log)、平方根(sqrt)、常量(PI, E)等。例如: "2 + 3 * 4", "sin(PI/2)", "log(100)", "sqrt(16)"',

  inputSchema: z.object({
    expression: z.string().describe('要计算的数学表达式，例如: "2 + 3 * 4", "(2 + 3) * 4", "2^10", "sin(PI/2)", "log(100)", "sqrt(16)"'),
  }),

  execute: async ({ expression }) => {
    console.log('ai调用了计算公式:',expression)
    try {
      // 使用 math.js 计算表达式
      const result = evaluate(expression);

      // 处理不同类型的结果
      let formattedResult: string | number | boolean;
      let resultType: string;

      if (typeof result === 'number') {
        // 如果是整数，不显示小数点
        if (Number.isInteger(result)) {
          formattedResult = result;
        } else {
          // 浮点数保留最多 10 位小数，去掉末尾的 0
          formattedResult = parseFloat(result.toFixed(10));
        }
        resultType = 'number';
      } else if (typeof result === 'bigint') {
        formattedResult = result.toString();
        resultType = 'bigint';
      } else if (typeof result === 'boolean') {
        formattedResult = result;
        resultType = 'boolean';
      } else if (result === null) {
        formattedResult = 'null';
        resultType = 'null';
      } else if (typeof result === 'object') {
        // 处理复数、矩阵等复杂类型
        formattedResult = JSON.stringify(result);
        resultType = 'object';
      } else {
        formattedResult = String(result);
        resultType = typeof result;
      }

      return {
        expression,
        result: formattedResult,
        resultType,
        success: true,
      };
    } catch (error) {
      // 返回错误信息
      return {
        expression,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  },
});
