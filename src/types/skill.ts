/**
 * Skill 类型定义
 *
 * 定义 AI Agent 技能系统的数据结构
 *
 * 国际化说明：
 * - 预置 Skills：name 和 description 存储 i18n key，通过 t() 获取翻译
 * - 用户自定义 Skills：name 和 description 直接存储用户输入的文本
 * - triggerKeywords：预置 Skills 使用多语言对象，用户自定义使用数组
 */

/**
 * Skill 数据结构
 */
export interface Skill {
  /** 唯一标识符 */
  id: string;
  /**
   * 技能名称
   * - 预置 Skills: 存储 i18n key（如 'presetSkills.sshOperations.name'）
   * - 用户自定义: 直接存储用户输入的文本
   */
  name: string;
  /**
   * 技能描述
   * - 预置 Skills: 存储 i18n key（如 'presetSkills.sshOperations.description'）
   * - 用户自定义: 直接存储用户输入的文本
   */
  description: string;
  /**
   * 触发关键词
   * - 预置 Skills: 按语言存储 { en: [...], cn: [...], de: [...] }
   * - 用户自定义: 简单数组 ['keyword1', 'keyword2']
   */
  triggerKeywords: string[] | Record<string, string[]>;
  /** 详细指令内容（Markdown 格式，始终保持英文以确保 AI 执行一致性） */
  instructions: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否为预置 Skill（不可删除） */
  isPreset: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 本地化的 Skill（用于 UI 展示）
 *
 * 通过 getLocalizedSkill() 函数从 Skill 转换而来
 */
export interface LocalizedSkill {
  /** 唯一标识符 */
  id: string;
  /** 已翻译的技能名称 */
  name: string;
  /** 已翻译的技能描述 */
  description: string;
  /** 当前语言的触发关键词 */
  triggerKeywords: string[];
  /** 详细指令内容 */
  instructions: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否为预置 Skill */
  isPreset: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 创建 Skill 输入
 */
export interface CreateSkillInput {
  /** 技能名称（用户自定义时直接存储文本） */
  name: string;
  /** 技能描述（用户自定义时直接存储文本） */
  description: string;
  /** 触发关键词列表（用户自定义时使用简单数组） */
  triggerKeywords: string[];
  /** 详细指令内容 */
  instructions: string;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 是否为预置 Skill（默认 false） */
  isPreset?: boolean;
}

/**
 * 更新 Skill 输入
 */
export interface UpdateSkillInput {
  name?: string;
  description?: string;
  triggerKeywords?: string[] | Record<string, string[]>;
  instructions?: string;
  enabled?: boolean;
}

/**
 * 类型守卫：判断 triggerKeywords 是否为多语言对象
 */
export function isLocalizedKeywords(
  keywords: string[] | Record<string, string[]>
): keywords is Record<string, string[]> {
  return typeof keywords === 'object' && !Array.isArray(keywords);
}

/**
 * 导出的 Skill 文件格式
 */
export interface SkillExportFormat {
  version: '1.0';
  exportedAt: string;
  skills: Skill[];
}
