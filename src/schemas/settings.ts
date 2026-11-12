import { z } from 'zod';

/**
 * 主题模式类型
 */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * 主题模式选项
 */
export const ThemeModeOptions = {
  System: 'system',
  Light: 'light',
  Dark: 'dark',
} as const satisfies Record<string, ThemeMode>;

/**
 * 创建外观设置 Schema（支持 i18n）
 */
export const createAppearanceSchema = (t: (key: string) => string) => z.object({
  themeMode: z.enum(['system', 'light', 'dark'], {
    message: t('settingsValidation.invalidThemeMode'),
  }),
});

/**
 * 外观设置表单类型
 */
export type AppearanceFormData = z.infer<ReturnType<typeof createAppearanceSchema>>;

/**
 * 语言类型
 */
export type Language = 'auto' | 'en' | 'cn';

/**
 * 语言选项
 */
export const LanguageOptions = {
  Auto: 'auto',
  English: 'en',
  Chinese: 'cn',
} as const satisfies Record<string, Language>;

/**
 * 创建通用设置 Schema（支持 i18n）
 */
export const createGeneralSchema = (t: (key: string) => string) => z.object({
  language: z.enum(['auto', 'en', 'cn'], {
    message: t('settingsValidation.invalidLanguage'),
  }),
});

/**
 * 通用设置表单类型
 */
export type GeneralFormData = z.infer<ReturnType<typeof createGeneralSchema>>;
