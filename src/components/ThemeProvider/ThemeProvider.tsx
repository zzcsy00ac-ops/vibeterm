import { useAppStore } from '../../store/appStore';
import type { ThemeMode } from '../../schemas/settings';

export type ThemeAppearance = 'light' | 'dark';

/**
 * 计算实际外观
 */
function computeAppearance(themeMode: ThemeMode, systemTheme: ThemeAppearance): ThemeAppearance {
  return themeMode === 'system' ? systemTheme : themeMode;
}

/**
 * 主题提供者 Hook
 * 响应式获取当前计算后的主题外观
 * 使用 selector 确保在 themeMode 或 systemTheme 变化时正确更新
 */
export function useTheme(): ThemeAppearance {
  const themeMode = useAppStore((state) => state.themeMode);
  const systemTheme = useAppStore((state) => state.systemTheme);
  return computeAppearance(themeMode, systemTheme);
}
