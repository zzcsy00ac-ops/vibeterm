/**
 * 单个工具按钮组件
 *
 * 根据 type 渲染不同类型的按钮：
 * - button: 普通导航按钮
 * - divider: 分隔符
 * - dropdown: 下拉菜单按钮 (设置)
 * - special: 特殊按钮 (更新提示)
 */

import { IconButton, Button, Container } from "@radix-ui/themes";
import { DropdownMenu } from "radix-ui";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SETTINGS_WINDOW_CONFIG } from "../../config/window";
import type { SideToolItem } from "./types";
import { Settings } from 'lucide-react';
import "./ToolButton.css";

export interface ToolButtonProps {
  item: SideToolItem;
  isActive?: boolean;
  onSidebarToggle?: () => void;
  needUpdate?: boolean;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragListeners?: any;
}

export function ToolButton({
  item,
  isActive = false,
  onSidebarToggle,
  needUpdate,
  dragAttributes,
  dragListeners
}: ToolButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // item.icon 是通过 useSideToolsItems() hook 动态注入的组件
  const IconComponent = item.icon || null;

  // 侧边栏切换按钮
  if (item.id === 'sidebar-toggle' && item.type === 'button') {
    return (
      <IconButton
        title={item.title.startsWith('app.') ? t(item.title as any) : item.title}
        size="1"
        variant="ghost"
        onClick={onSidebarToggle}
        className="toggle-button"
        {...dragAttributes}
        {...dragListeners}
      >
        {IconComponent ? <IconComponent size={20} /> : null}
      </IconButton>
    );
  }

  // 分隔符
  if (item.type === 'divider') {
    return <Container size="1" />;
  }

  // 更多下拉菜单
  if (item.type === 'dropdown' && item.id === 'mores') {
    const openSettings = async () => {
      const existingWindow = await WebviewWindow.getByLabel('settings');

      if (existingWindow) {
        await existingWindow.show();
        await existingWindow.setFocus();
        await existingWindow.setAlwaysOnTop(true);
        await existingWindow.setAlwaysOnTop(false);
        return;
      }

      const mainWindow = getCurrentWindow();
      const mainPosition = await mainWindow.outerPosition();
      const mainSize = await mainWindow.outerSize();

      const settingsX = mainPosition.x + (mainSize.width - SETTINGS_WINDOW_CONFIG.width) / 2;
      const settingsY = mainPosition.y + (mainSize.height - SETTINGS_WINDOW_CONFIG.height) / 2;

      new WebviewWindow('settings', {
        url: '/settings',
        title: t('app.settings'),
        width: SETTINGS_WINDOW_CONFIG.width,
        height: SETTINGS_WINDOW_CONFIG.height,
        x: settingsX,
        y: settingsY,
        resizable: SETTINGS_WINDOW_CONFIG.resizable,
        decorations: SETTINGS_WINDOW_CONFIG.decorations,
        visible: false,
      });
    };

    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton
            title={t(item.title as any)}
            size="1"
            variant="ghost"
            className="toggle-button"
            {...dragAttributes}
            {...dragListeners}
          >
            {IconComponent ? <IconComponent size={20} /> : null}
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="dropdown-menu-content" sideOffset={5}>
            <DropdownMenu.Item className="dropdown-menu-item" onClick={openSettings}>
              <Settings size='1em' />
              {t('app.settings')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  // 更新提示按钮 (特殊)
  if (item.type === 'special' && item.id === 'update') {
    if (!needUpdate) return null;
    return (
      <Button>
        {IconComponent ? <IconComponent size='1em' /> : null}
        {t(item.title as any)}
      </Button>
    );
  }

  // 普通导航按钮
  if (item.type === 'button' && item.route) {
    const active = isActive || location.pathname === item.route;
    return (
      <IconButton
        title={t(item.title as any)}
        size="1"
        variant="ghost"
        onClick={() => navigate(item.route!)}
        className={`toggle-button ${active ? 'active' : ''}`}
        {...dragAttributes}
        {...dragListeners}
      >
        {IconComponent ? <IconComponent size={20} /> : null}
      </IconButton>
    );
  }

  return null;
}
