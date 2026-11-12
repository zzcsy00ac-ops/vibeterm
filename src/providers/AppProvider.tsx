import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { changeAppLanguage } from '../utils/languageUtils';

/**
 * 应用全局状态同步 Provider
 *
 * 处理需要副作用的 store 状态变化：
 * - language: 自动同步到 i18next
 *
 * 未来可扩展其他状态（例如：serverUrl 变化时重连服务器）
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((state) => state.language);

  // 同步语言到 i18next
  useEffect(() => {
    console.log('[AppProvider] Language changed to:', language);
    changeAppLanguage(language);
  }, [language]);

  return <>{children}</>;
}
