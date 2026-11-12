import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { useSpring, animated } from '@react-spring/web';
import SideTools from "../components/SideTools/SideTools";
import { SIDEBAR_CONFIG } from "../config/layout";
import { Flex } from "@radix-ui/themes";
import { useEffect } from "react";
import "./MainLayout.css";
import { MainContent } from "../components/MainContent/MainContent";
import { GlobalSFTPSheet } from "../components/SFTPSheet/GlobalSFTPSheet";
import { SudoPasswordDialog } from "../components/SudoPasswordDialog";

function MainLayout() {
  const { isSidebarCollapsed, getFirstNavigableRoute } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = usePanelRef();

  // 动态获取默认路由（从工具栏配置中第一个可导航项获取）
  const defaultRoute = getFirstNavigableRoute() || '/chats';

  const [props] = useSpring(() => ({
    from: {
      maxSize: isSidebarCollapsed ? SIDEBAR_CONFIG.maxSize : SIDEBAR_CONFIG.collapsedSize,
      minSize: isSidebarCollapsed ? SIDEBAR_CONFIG.minSize : SIDEBAR_CONFIG.collapsedSize,
    },
    to: {
      maxSize: isSidebarCollapsed ? SIDEBAR_CONFIG.collapsedSize : SIDEBAR_CONFIG.maxSize,
      minSize: isSidebarCollapsed ? SIDEBAR_CONFIG.collapsedSize : SIDEBAR_CONFIG.minSize,
    },
    onStart: () => {
      if (!isSidebarCollapsed) {
        panelRef.current?.resize(SIDEBAR_CONFIG.minSize);
      }
    }
  }), [isSidebarCollapsed]);

  // 默认导航到第一个可用的工具栏页面
  useEffect(() => {
    if (location.pathname === '/') {
      navigate(defaultRoute, { replace: true });
    }
  }, [location.pathname, navigate, defaultRoute]);

  const AnimatedPanel = animated(Panel);

  return (
    <main className="app-container">
      <div className="sidebarToolsContainer">
      </div>
      <Group orientation="horizontal" className="panel-group">
        {/* 左侧边栏：SideTools + Outlet (sessions/ssh 页面) */}
        <SideTools />
        <AnimatedPanel
          panelRef={panelRef}
          collapsedSize={SIDEBAR_CONFIG.collapsedSize}
          defaultSize={SIDEBAR_CONFIG.defaultSize}
          className="panel-sidebar"
          {...props}
        >
          <Flex direction="column" className="side-content">
            <Outlet />
          </Flex>
        </AnimatedPanel>
        <Separator className="resize-handle" />
        {/* 右侧多标签区域 */}
        <Panel style={{ overflow: 'hidden' }}>
          <MainContent />
        </Panel>
      </Group>

      {/* 全局 SFTP Sheet - 单一实例，避免多 Tab 冲突 */}
      <GlobalSFTPSheet />

      {/* 全局 Sudo 密码弹窗 */}
      <SudoPasswordDialog />
    </main>
  );
}

export default MainLayout;
