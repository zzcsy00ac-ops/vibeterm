/**
 * 语言工具函数
 */

import i18n from '../i18n';
import type { Language } from '../schemas/settings';

/**
 * 获取系统语言
 */
export function getSystemLanguage(): Language {
  const browserLang = navigator.language;

  // 简单的中文检测
  if (browserLang.startsWith('zh')) {
    return 'cn';
  }

  // 默认返回英文
  return 'en';
}

/**
 * 解析语言选项，如果是 'auto' 则返回系统语言
 */
export function resolveLanguage(language: Language): string {
  if (language === 'auto') {
    return getSystemLanguage();
  }
  return language;
}

/**
 * 切换应用语言
 */
export function changeAppLanguage(language: Language) {
  const resolvedLang = resolveLanguage(language);
  i18n.changeLanguage(resolvedLang);
}
