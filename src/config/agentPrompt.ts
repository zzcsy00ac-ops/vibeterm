/**
 * AI Agent 系统提示词配置
 *
 * 定义 AI Agent 的默认行为指令和交互规则
 * 版本: v2.1.0
 * 更新时间: 2026-02-27
 *
 * v2.1.0 变更：支持 Skills 指令注入
 * v2.0.0 变更：实现动态提示词国际化，根据语言环境加载对应提示词
 */

import cnPrompt from './prompts/cn';
import enPrompt from './prompts/en';
import dePrompt from './prompts/de';
import type { Skill } from '../types/skill';

/**
 * 提示词版本
 */
export const PROMPT_VERSION = 'v2.1.0';

/**
 * 提示词更新时间
 */
export const PROMPT_UPDATED_AT = '2026-02-27';

/**
 * 多语言提示词映射
 */
const PROMPTS = {
  'cn': cnPrompt,
  'en': enPrompt,
  'de': dePrompt,
} as const;

/**
 * 支持的语言列表
 */
export const SUPPORTED_LOCALES = ['cn', 'en', 'de'] as const;

/**
 * 默认语言
 */
const DEFAULT_LOCALE = 'en';

/**
 * 获取系统提示词
 *
 * 根据语言环境动态加载对应语言的系统提示词，用于 AI SDK ToolLoopAgent 的 instructions 参数
 *
 * 提示词采用结构化分层设计：
 * - 身份定位
 * - 核心能力
 * - 可用工具
 * - Token 节省原则
 * - 工作流程
 * - 输出规范
 * - 安全约束
 * - 交互风格
 *
 * @param customInstructions - 自定义指令（可选）。如果提供，则直接返回自定义指令
 * @param locale - 语言代码（'cn', 'en', 'de'）。默认为 'en'
 * @returns 系统提示词
 *
 * @example
 * ```typescript
 * // 获取中文提示词
 * const cnPrompt = getAgentInstructions(undefined, 'cn');
 *
 * // 获取英文提示词（默认）
 * const enPrompt = getAgentInstructions();
 *
 * // 使用自定义指令
 * const customPrompt = getAgentInstructions('You are a helpful assistant');
 * ```
 */
export function getAgentInstructions(customInstructions?: string, locale?: string): string {
  // 如果有自定义指令，直接返回
  if (customInstructions) {
    return customInstructions;
  }

  // 获取语言代码，默认使用英文
  const lang = locale || DEFAULT_LOCALE;

  // 返回对应语言的提示词，如果语言不支持则 fallback 到英文
  return PROMPTS[lang as keyof typeof PROMPTS] || PROMPTS[DEFAULT_LOCALE];
}

/**
 * 获取带 Skills 的系统提示词
 *
 * 在基础提示词后追加激活的 Skills 指令
 *
 * @param customInstructions - 自定义指令（可选）
 * @param locale - 语言代码
 * @param activeSkills - 激活的 Skills 列表
 * @returns 包含 Skills 指令的系统提示词
 *
 * @example
 * ```typescript
 * const skills = useSkillStore.getState().getActiveSkills();
 * const prompt = getAgentInstructionsWithSkills(undefined, 'cn', skills);
 * ```
 */
export function getAgentInstructionsWithSkills(
  customInstructions?: string,
  locale?: string,
  activeSkills?: Skill[]
): string {
  // 获取基础提示词
  const basePrompt = getAgentInstructions(customInstructions, locale);

  // 如果没有激活的 Skills，直接返回基础提示词
  if (!activeSkills || activeSkills.length === 0) {
    return basePrompt;
  }

  // 构建 Skills 指令部分
  const skillsInstructions = activeSkills
    .map((skill) => `## ${skill.name}\n\n${skill.instructions}`)
    .join('\n\n---\n\n');

  // 拼接基础提示词和 Skills 指令
  return `${basePrompt}

# 专业技能

以下是你可以使用的专业技能。当用户的请求与某个技能相关时，请参考该技能的指导原则来完成任务。

${skillsInstructions}`;
}

/**
 * 获取 Skills 描述（用于 UI 展示或调试）
 *
 * @param activeSkills - 激活的 Skills 列表
 * @returns Skills 描述文本
 */
export function getSkillsDescription(activeSkills: Skill[]): string {
  if (activeSkills.length === 0) {
    return '';
  }

  return activeSkills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join('\n');
}
