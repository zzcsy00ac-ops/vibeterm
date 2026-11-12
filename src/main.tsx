import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "./components/ThemeProvider/ThemeProvider";
import { useAppStore } from "./store/appStore";
import { AppProvider } from "./providers/AppProvider";
import { SSHPasswordPrompt } from "./components/SSHPasswordPrompt/SSHPasswordPrompt";
import { KeyPassphrasePrompt } from "./components/KeyPassphrasePrompt/KeyPassphrasePrompt";

const appWindow = getCurrentWindow();

function WindowWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    appWindow.show();
  }, []);

  return <>{children}</>;
}

function ThemedApp() {
  const appearance = useTheme();
  // 获取 themeMode 以区分用户是否选择了"跟随系统"
  const themeMode = useAppStore((state) => state.themeMode);

  // 添加调试日志
  React.useEffect(() => {
    console.log('[ThemedApp] appearance changed:', appearance, 'themeMode:', themeMode);
  }, [appearance, themeMode]);

  // 构建类名：同时包含主题模式和实际外观
  const themeClasses = [
    `theme-${appearance}`,
    themeMode === 'system' && 'theme-system'
  ].filter(Boolean).join(' ');

  return (
    <Theme
      appearance={appearance}
      hasBackground={false}
      scaling="100%"
      radius="small"
      accentColor="tomato"
      grayColor="gray"
      panelBackground="translucent"
      className={themeClasses}
    >
      <WindowWrapper>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <SSHPasswordPrompt />
        <KeyPassphrasePrompt />
      </WindowWrapper>
    </Theme>
  );
}

/**
 * 应用启动入口
 */
async function bootstrap() {
  // 预加载 store 模块（触发顶层 await 初始化）
  await import("./store/appStore");

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </React.StrictMode>,
  );

  // 禁用全局右键菜单 - 打造原生应用体验
  // 但允许在特定元素上使用（如输入框、终端等）
  document.addEventListener('contextmenu', (e) => {
    // 检查事件目标是否在允许右键菜单的元素内
    const target = e.target as HTMLElement;
    const allowContextMenu =
      target.closest('.allow-context-menu') ||
      target.closest('.context-menu-trigger') ||  // ContextMenu 组件使用
      target.closest('.message-item-content') ||  // 消息内容区域
      target.closest('input, textarea, [contenteditable="true"]');

    if (!allowContextMenu) {
      e.preventDefault();
    }
  }, { capture: true });
}

// 启动应用
bootstrap();
