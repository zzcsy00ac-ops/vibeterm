/**
 * XtermTerminal 组件
 *
 * 基于 xterm.js 的终端模拟器组件
 * 用于 SSH 终端显示和交互
 */

import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../ThemeProvider/ThemeProvider';
import type { XtermTerminalProps, XtermTerminalRef } from './XtermTerminal.types';
import './XtermTerminal.css';

// 导入 xterm 样式
import '@xterm/xterm/css/xterm.css';

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * XtermTerminal 组件
 */
export const XtermTerminal = forwardRef<XtermTerminalRef, XtermTerminalProps>(({
  onData,
  localEcho = false, // 默认不本地回显（用于 SSH）
}, ref) => {
  // 从 store 获取终端配置（不包括 theme）
  const terminalConfig = useAppStore((state) => state.terminalConfig);
  // 使用当前主题 appearance
  const appearance = useTheme();

  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  // 终端实例引用
  const terminalRef = useRef<Terminal | null>(null);
  // Fit 插件引用
  const fitAddonRef = useRef<FitAddon | null>(null);

  // 右键选择保存（使用 ref 确保在 effect 重新运行时不会丢失）
  const savedSelectionRef = useRef<string | null>(null);
  const contextMenuHandledRef = useRef<boolean>(false);

  /**
   * 调整终端尺寸
   */
  const fitTerminal = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current || !containerRef.current) return;

    // 先让 FitAddon 计算初始尺寸
    fitAddonRef.current.fit();

    // 检查是否有剩余空间，如果有则增加一行
    const containerHeight = containerRef.current.clientHeight;
    const screen = containerRef.current.querySelector('.xterm-screen') as HTMLElement;
    if (screen) {
      const screenHeight = screen.clientHeight;
      const gap = containerHeight - screenHeight;
      // 如果剩余空间超过一行字符高度的一半，就增加一行
      if (gap > 10) {
        const currentRows = terminalRef.current.rows;
        terminalRef.current.resize(terminalRef.current.cols, currentRows + 1);
      }
    }
  }, []);

  /**
   * 初始化终端
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // 使用 ref 来跟踪这个 effect 是否仍然有效
    const validRef = { current: true };

    // 创建终端实例
    const terminal = new Terminal({
      theme: appearance === 'dark' ? {
        background: '#1a1a1a',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      } : {
        background: '#ffffff',
        foreground: '#191919',
        cursor: '#191919',
        selectionBackground: 'rgba(0, 0, 0, 0.1)',
        black: '#191919',
        red: '#e5484d',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#3b8eea',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#dedede',
        brightBlack: '#787878',
        brightRed: '#e5484d',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#191919',
      },
      fontSize: terminalConfig.fontSize,
      fontFamily: terminalConfig.fontFamily,
      cursorBlink: terminalConfig.cursorBlink,
      cursorStyle: 'block',
      scrollback: terminalConfig.scrollback,
      tabStopWidth: 4,
    });

    // 创建并加载插件
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon(
      async (event, uri) => {
        // Only open if Command (macOS) or Ctrl (Windows) is held
        const isModifierPressed = event.metaKey || event.ctrlKey;
        if (!isModifierPressed) {
          return;
        }

        event.preventDefault();
        try {
          const url = new URL(uri);
          if (url.protocol === 'https:' || url.protocol === 'http:') {
            await openUrl(uri);
          }
        } catch (e) {
          console.error('[XtermTerminal] Invalid URL:', uri);
        }
      }
    );
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // 挂载终端到容器
    terminal.open(containerRef.current);

    // 在 mousedown 时保存选中内容（button 2 = 右键）
    // 使用 ref 确保在 effect 重新运行时不会丢失
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        const currentSelection = terminal.getSelection();
        // 只有当有选择时才保存（避免覆盖之前保存的选择）
        if (currentSelection) {
          savedSelectionRef.current = currentSelection;
        }
        contextMenuHandledRef.current = false;
      }
    };

    // 右键菜单处理函数
    const handleXtermContextMenu = async (e: MouseEvent) => {
      if (contextMenuHandledRef.current) {
        return;
      }
      contextMenuHandledRef.current = true;

      e.preventDefault();
      e.stopImmediatePropagation();

      const selection = savedSelectionRef.current;
      savedSelectionRef.current = null;

      if (selection) {
        // 有选中文本 → 只复制
        terminal.clearSelection();
        terminal.refresh(0, terminal.rows - 1);
        savedSelectionRef.current = null;

        try {
          await writeText(selection);
        } catch (err) {
          console.error('[XtermTerminal] Failed to copy:', err);
        }
        return;
      }

      // 无选中文本 → 粘贴
      try {
        const text = await readText();
        if (text) {
          if (onData) {
            onData(text);
          }
          if (localEcho) {
            terminal.write(text);
          }
        }
      } catch (err) {
        console.error('[XtermTerminal] Failed to paste:', err);
      }
    };

    // 添加右键菜单事件监听（捕获阶段）
    containerRef.current.addEventListener('mousedown', handleMouseDown, true);
    containerRef.current.addEventListener('contextmenu', handleXtermContextMenu, true);

    // 自动调整尺寸
    fitAddon.fit();

    // 保存引用
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 只在非 SSH 模式下显示欢迎消息
    if (localEcho) {
      const welcomeMessage = [
        '\r\n\x1b[1;36m╔═══════════════════════════════════════════════════════════════╗\x1b[0m',
        '\x1b[1;36m║\x1b[0m                                                               \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m║\x1b[0m  \x1b[1;33m▶ SSH Terminal Demo - xterm.js Verification\x1b[0m                    \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m║\x1b[0m                                                               \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m║\x1b[0m  \x1b[2;37mThis is a demo terminal to verify xterm.js integration.\x1b[0m      \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m║\x1b[0m  \x1b[2;37mSSH connection will be implemented in future phases.\x1b[0m      \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m║\x1b[0m                                                               \x1b[1;36m║\x1b[0m',
        '\x1b[1;36m╚═══════════════════════════════════════════════════════════════╝\x1b[0m',
        '\r\n',
        '\x1b[32m➜\x1b[0m \x1b[1;34m~\x1b[0m ',
      ].join('\r\n');
      terminal.write(welcomeMessage);
    }

    // 处理用户输入
    terminal.onData((data) => {
      if (!validRef.current) return; // 如果 effect 已被清理，忽略事件

      // SSH 模式：不本地回显，让服务器处理
      // 本地演示模式：本地回显
      if (localEcho) {
        terminal.write(data);

        // 回车键处理
        if (data === '\r') {
          terminal.write('\r\n');
          // 显示新的提示符
          setTimeout(() => {
            terminal.write('\x1b[32m➜\x1b[0m \x1b[1;34m~\x1b[0m ');
          }, 10);
        }
      }

      // 通知父组件（用于 SSH 连接）
      if (onData) {
        onData(data);
      }
    });

    // 窗口尺寸变化时调整终端尺寸（保留原有逻辑作为备用）
    const debouncedFit = debounce(fitTerminal, 100);
    const handleResize = () => {
      debouncedFit();
    };

    window.addEventListener('resize', handleResize);

    // IntersectionObserver - 监听容器可见性变化（处理标签页切换）
    // 当终端容器从 display: none 变为可见时，需要重新调整尺寸
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 当容器变为可见时（intersectionRatio > 0 表示至少部分可见）
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            // 使用 requestAnimationFrame 确保在下一帧执行，让浏览器完成重排
            requestAnimationFrame(() => {
              // 再加一个小延迟，确保布局完全稳定
              setTimeout(() => {
                if (validRef.current) {
                  fitTerminal();
                  // 可选：自动聚焦到终端（提升用户体验）
                  terminalRef.current?.focus();
                }
              }, 50);
            });
          }
        });
      },
      {
        // threshold: 0 表示任何可见性变化都触发
        threshold: 0,
      }
    );

    // ResizeObserver - 监听容器尺寸变化（处理窗口大小调整）
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // 只有当尺寸有效且大于 0 时才执行 fit
        // 这避免了在隐藏容器（display: none）中执行无效的尺寸调整
        if (width > 0 && height > 0) {
          // 使用 requestAnimationFrame 确保在浏览器重排后执行
          requestAnimationFrame(() => {
            if (validRef.current) {
              debouncedFit();
            }
          });
        }
      }
    });

    if (containerRef.current) {
      intersectionObserver.observe(containerRef.current);
      resizeObserver.observe(containerRef.current);
    }

    // 清理函数
    return () => {
      validRef.current = false; // 标记 effect 为无效
      window.removeEventListener('resize', handleResize);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      // 移除右键菜单监听
      containerRef.current?.removeEventListener('contextmenu', handleXtermContextMenu, true);
      containerRef.current?.removeEventListener('mousedown', handleMouseDown, true);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [appearance, terminalConfig, onData, fitTerminal]);

  /**
   * 暴露给父组件的方法
   */
  useImperativeHandle(ref, () => ({
    /**
     * 向终端写入数据
     */
    write: (data: string) => {
      terminalRef.current?.write(data);
    },

    /**
     * 清空终端
     */
    clear: () => {
      terminalRef.current?.clear();
    },

    /**
     * 获取终端实例
     */
    getTerminal: () => terminalRef.current,

    /**
     * 调整终端尺寸
     */
    resize: (cols: number, rows: number) => {
      terminalRef.current?.resize(cols, rows);
    },

    /**
     * 聚焦终端
     */
    focus: () => {
      terminalRef.current?.focus();
    },

    /**
     * 重新调整终端尺寸以适应容器
     */
    fit: fitTerminal,
  }));

  return (
    <div
      ref={containerRef}
      className="xterm-terminal"
    />
  );
});

XtermTerminal.displayName = 'XtermTerminal';

export default XtermTerminal;
