/**
 * 通用 ContextMenu 组件
 *
 * 支持两种使用模式：
 * 1. Radix UI 触发模式：使用 asChild 包装触发元素
 * 2. 手动定位模式：通过 x, y 坐标和 visible 状态控制显示
 */

import * as RadixContextMenu from '@radix-ui/react-context-menu';
import { type FC, useEffect, useRef, useState } from 'react';
import type {
  ContextMenuItem,
  ContextMenuPositionProps,
  ContextMenuProps,
  ContextMenuTriggerProps,
} from './types';
import { isPositionMode, isTriggerMode } from './types';
import './ContextMenu.css';

// ==================== Radix UI 触发模式组件 ====================

const ContextMenuTrigger: FC<ContextMenuTriggerProps> = (props) => {
  const { items, children, alignOffset = -5 } = props;

  // 渲染单个菜单项
  const renderMenuItem = (item: ContextMenuItem) => {
    // 兼容处理：支持 id/key 和 title/label
    const key = item.key || item.id || '';
    const label = item.label || item.title || '';

    // 条件隐藏
    if (item.hide) {
      return null;
    }

    return (
      <RadixContextMenu.Root key={key}>
        {item.separator ? <RadixContextMenu.Separator className="context-menu-separator" /> : null}

        <RadixContextMenu.Item
          className={`context-menu-item ${item.danger ? 'context-menu-item--danger' : ''} ${item.disabled ? 'context-menu-item--disabled' : ''}`}
          onSelect={item.onClick}
          disabled={item.disabled}
        >
          {item.icon ? <span className="context-menu-item__icon">{item.icon}</span> : null}
          <span className="context-menu-item__label">{label}</span>
          {item.shortcut ? <span className="context-menu-item__shortcut">{item.shortcut}</span> : null}
        </RadixContextMenu.Item>
      </RadixContextMenu.Root>
    );
  };

  return (
    <RadixContextMenu.Root modal={false}>
      <RadixContextMenu.Trigger asChild>
        <div className="context-menu-trigger">
          {children}
        </div>
      </RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="context-menu" alignOffset={alignOffset}>
          {items.map(renderMenuItem)}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
};

// ==================== 手动定位模式组件 ====================

const ContextMenuPosition: FC<ContextMenuPositionProps> = (props) => {
  const { visible, x, y, items, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedY, setAdjustedY] = useState(y);

  // 自动调整位置避免超出视口
  useEffect(() => {
    if (menuRef.current && visible) {
      const menuHeight = menuRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;
      const bottomSpace = viewportHeight - y;

      // 如果底部空间不足以显示菜单，则向上显示
      if (bottomSpace < menuHeight) {
        setAdjustedY(y - menuHeight);
      } else {
        setAdjustedY(y);
      }
    }
  }, [y, visible]);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [visible, onClose]);

  // 渲染单个菜单项
  const renderMenuItem = (item: ContextMenuItem) => {
    // 兼容处理：支持 id/key 和 title/label
    const key = item.key || item.id || '';
    const label = item.label || item.title || '';

    // 条件隐藏
    if (item.hide) {
      return null;
    }

    return (
      <div
        key={key}
        className={`context-menu-item ${item.danger ? 'context-menu-item--danger' : ''} ${item.disabled ? 'context-menu-item--disabled' : ''}`}
        onClick={() => !item.disabled && item.onClick()}
      >
        {item.icon ? <span className="context-menu-item__icon">{item.icon}</span> : null}
        <span className="context-menu-item__label">{label}</span>
        {item.shortcut ? <span className="context-menu-item__shortcut">{item.shortcut}</span> : null}
      </div>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="context-menu context-menu--fixed"
      style={{
        left: x,
        top: adjustedY,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        // 分隔线渲染在菜单项之前
        const showSeparator = item.separator && index > 0;
        return (
          <div key={item.key || item.id || index}>
            {showSeparator ? <div className="context-menu-separator" /> : null}
            {renderMenuItem(item)}
          </div>
        );
      })}
    </div>
  );
};

// ==================== 主组件 ====================

/**
 * 通用 ContextMenu 组件
 *
 * @example Radix UI 触发模式
 * ```tsx
 * <ContextMenu items={menuItems}>
 *   <div>右键点击我</div>
 * </ContextMenu>
 * ```
 *
 * @example 手动定位模式
 * ```tsx
 * <ContextMenu
 *   visible={show}
 *   x={x}
 *   y={y}
 *   items={menuItems}
 *   onClose={() => setShow(false)}
 * />
 * ```
 */
export const ContextMenu: FC<ContextMenuProps> = (props) => {
  if (isPositionMode(props)) {
    return <ContextMenuPosition {...props} />;
  }

  if (isTriggerMode(props)) {
    return <ContextMenuTrigger {...props} />;
  }

  return null;
};

ContextMenu.displayName = 'ContextMenu';

// ==================== 导出 ====================

export default ContextMenu;
