/**
 * Skill 国际化辅助函数
 *
 * 提供获取本地化 Skill 内容的工具函数
 */

import type { TFunction } from 'i18next';
import type { Skill, LocalizedSkill } from '../types/skill';
import { isLocalizedKeywords } from '../types/skill';

/**
 * 获取当前语言对应的触发关键词
 *
 * @param skill - Skill 对象
 * @param locale - 当前语言代码
 * @returns 当前语言的触发关键词数组
 */
export function getActiveKeywords(
  skill: Skill,
  locale: string
): string[] {
  if (isLocalizedKeywords(skill.triggerKeywords)) {
    // 优先使用当前语言，其次英文，最后返回空数组
    return skill.triggerKeywords[locale] || skill.triggerKeywords['en'] || [];
  }
  // 用户自定义 Skill 使用简单数组
  return skill.triggerKeywords;
}

/**
 * 检查是否为 i18n key
 *
 * @param value - 要检查的值
 * @returns 是否为 i18n key
 */
function isI18nKey(value: string): boolean {
  return value.startsWith('presetSkills.');
}

/**
 * 获取本地化的 Skill 名称
 *
 * - 预置 Skills: 通过 i18n key 获取翻译
 * - 用户自定义 Skills: 直接返回原始名称
 *
 * @param skill - Skill 对象
 * @param t - i18next 翻译函数
 * @returns 本地化的名称
 */
export function getLocalizedName(skill: Skill, t: TFunction): string {
  // 预置 Skills 使用 i18n key（以 'presetSkills.' 开头）
  if (isI18nKey(skill.name)) {
    // 使用类型断言来处理动态 i18n key
    return t(skill.name as any, { defaultValue: skill.name });
  }
  // 用户自定义 Skills 直接返回原始名称
  return skill.name;
}

/**
 * 获取本地化的 Skill 描述
 *
 * - 预置 Skills: 通过 i18n key 获取翻译
 * - 用户自定义 Skills: 直接返回原始描述
 *
 * @param skill - Skill 对象
 * @param t - i18next 翻译函数
 * @returns 本地化的描述
 */
export function getLocalizedDescription(skill: Skill, t: TFunction): string {
  // 预置 Skills 使用 i18n key（以 'presetSkills.' 开头）
  if (isI18nKey(skill.description)) {
    // 使用类型断言来处理动态 i18n key
    return t(skill.description as any, { defaultValue: skill.description });
  }
  // 用户自定义 Skills 直接返回原始描述
  return skill.description;
}

/**
 * 获取完整的本地化 Skill 对象
 *
 * 将 Skill 转换为 LocalizedSkill，所有字段都已本地化
 *
 * @param skill - 原始 Skill 对象
 * @param t - i18next 翻译函数
 * @param locale - 当前语言代码
 * @returns 本地化的 Skill 对象
 */
export function getLocalizedSkill(
  skill: Skill,
  t: TFunction,
  locale: string
): LocalizedSkill {
  return {
    id: skill.id,
    name: getLocalizedName(skill, t),
    description: getLocalizedDescription(skill, t),
    triggerKeywords: getActiveKeywords(skill, locale),
    instructions: skill.instructions,
    enabled: skill.enabled,
    isPreset: skill.isPreset,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
}

/**
 * 批量获取本地化 Skills
 *
 * @param skills - Skill 数组
 * @param t - i18next 翻译函数
 * @param locale - 当前语言代码
 * @returns 本地化的 Skill 数组
 */
export function getLocalizedSkills(
  skills: Skill[],
  t: TFunction,
  locale: string
): LocalizedSkill[] {
  return skills.map((skill) => getLocalizedSkill(skill, t, locale));
}
