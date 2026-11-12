import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import MainLayout from "./layouts/MainLayout";
import Settings from "./pages/Settings/Settings";
// 懒加载页面
import { Chats, Monitor, GeneralSettings, AppearanceSettings, SkillsSettings, AdvancedSettings, DataSettings } from "./routes";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { Toaster } from "sonner";
import "./App.css";

// 懒加载核心功能页面（减少初始包大小）
const SshManager = lazy(() => import("./pages/SshManager/SshManager"));
const ProviderManager = lazy(() => import("./pages/ProviderManager/ProviderManager"));

// 懒加载包装器
function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
}

function App() {
  return (
    <>
      <Routes>
        {/* 主布局路由 */}
        <Route path="/" element={<MainLayout />}>
          {/* 默认重定向到聊天 */}
          <Route index element={<Navigate to="/chats" replace />} />
        {/* 聊天列表 - 懒加载 */}
        <Route
          path="chats"
          element={
            <LazyWrapper>
              <Chats />
            </LazyWrapper>
          }
        />
        {/* SSH 管理 - 懒加载 */}
        <Route
          path="ssh"
          element={
            <LazyWrapper>
              <SshManager />
            </LazyWrapper>
          }
        />
        {/* 模型供应商管理 - 懒加载 */}
        <Route
          path="providers"
          element={
            <LazyWrapper>
              <ProviderManager />
            </LazyWrapper>
          }
        />
        {/* 旧路径重定向 */}
        <Route path="sessions" element={<Navigate to="/chats" replace />} />
      </Route>

      {/* 设置页面 - 嵌套路由 */}
      <Route path="/settings" element={<Settings />}>
        {/* 默认重定向到通用设置 */}
        <Route index element={<Navigate to="general" replace />} />
        {/* Settings 子页面 - 懒加载 */}
        <Route
          path="general"
          element={
            <LazyWrapper>
              <GeneralSettings />
            </LazyWrapper>
          }
        />
        <Route
          path="appearance"
          element={
            <LazyWrapper>
              <AppearanceSettings />
            </LazyWrapper>
          }
        />
        <Route
          path="skills"
          element={
            <LazyWrapper>
              <SkillsSettings />
            </LazyWrapper>
          }
        />
        <Route
          path="contact"
          element={
            <LazyWrapper>
              <AdvancedSettings />
            </LazyWrapper>
          }
        />
        <Route
          path="data"
          element={
            <LazyWrapper>
              <DataSettings />
            </LazyWrapper>
          }
        />
      </Route>

      {/* 监控页面 - 独立窗口，懒加载 */}
      <Route
        path="/monitor"
        element={
          <LazyWrapper>
            <Monitor />
          </LazyWrapper>
        }
      />
    </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
