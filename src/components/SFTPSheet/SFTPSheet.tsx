/**
 * SFTP Sheet 主组件
 *
 * 从下到上弹出的文件管理面板，集成 Radix UI Dialog 和 Framer Motion
 */

import * as Dialog from '@radix-ui/react-dialog';
import { type FC, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useSFTPSheet } from '../../store/sftpStore';
import type { SFTPConnectConfig } from '../../store/sftpStore';
import { SFTPToolbar } from './SFTPToolbar';
import { SFTPTransferProgress } from './SFTPTransferProgress';
import { SFTPUploadTasks } from '../SFTPUploadTasks/SFTPUploadTasks';
import { SFTPDownloadTasks } from '../SFTPDownloadTasks/SFTPDownloadTasks';
import { SFTPFileList } from './SFTPFileList';
import './SFTPSheet.css';

// ==================== 类型定义 ====================

export interface SFTPSheetProps {
  /** Sheet 是否打开 */
  open?: boolean;
  /** 打开状态变化回调 */
  onOpenChange?: (open: boolean) => void;
  /** SSH 会话 ID（可选，如果不提供则使用 store 中的 sessionId） */
  sessionId?: string;
  /** SFTP 连接配置（可选，如果不提供则无法连接） */
  connectionConfig?: SFTPConnectConfig;
  /** 初始路径（默认为 '/'） */
  initialPath?: string;
}

// ==================== 动画配置 ====================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

const sheetVariants = {
  hidden: {
    y: '100%' as const,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
      mass: 0.8,
    },
  },
  exit: {
    y: '100%' as const,
    opacity: 0,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
      ease: 'easeIn' as const,
    },
  },
};

// ==================== 组件 ====================

export const SFTPSheet: FC<SFTPSheetProps> = ({
  open: controlledOpen,
  onOpenChange,
  sessionId: propSessionId,
  connectionConfig: propConnectionConfig,
  initialPath = '/',
}) => {
  const {
    isOpen,
    sessionId: storeSessionId,
    closeSheet,
    initProgressListeners,
  } = useSFTPSheet();

  // 使用受控或非受控模式
  const isControlled = controlledOpen !== undefined;
  const actualOpen = isControlled ? controlledOpen : isOpen;

  // 处理打开状态变化
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      closeSheet();
    }
    onOpenChange?.(newOpen);
  };

  // 当 propSessionId 变化时，打开面板
  useEffect(() => {
    if (propSessionId && propConnectionConfig && actualOpen && propSessionId !== storeSessionId) {
      const { openSheet } = useSFTPSheet.getState();
      openSheet(propSessionId, propConnectionConfig, initialPath);
    }
  }, [propSessionId, propConnectionConfig, actualOpen, initialPath, storeSessionId]);

  // 使用 ref 跟踪已注册监听器的 sessionId，避免重复注册
  const lastSessionIdRef = useRef<string | null>(null);

  // 初始化进度监听
  useEffect(() => {
    if (actualOpen && storeSessionId) {
      // 只有 sessionId 变化时才重新注册监听器
      if (lastSessionIdRef.current !== storeSessionId) {
        lastSessionIdRef.current = storeSessionId;
        const cleanup = initProgressListeners();
        return cleanup;
      }
    } else {
      // Sheet 关闭时清理跟踪的 sessionId
      lastSessionIdRef.current = null;
    }
  }, [actualOpen, storeSessionId]); // 移除 initProgressListeners 依赖

  return (
    <Dialog.Root open={actualOpen} onOpenChange={handleOpenChange} modal={false}>
      <AnimatePresence>
        {actualOpen && (
          <>
            {/* 背景遮罩（半透明，点击可关闭） */}
            <Dialog.Overlay asChild>
              <motion.div
                className="sftp-overlay"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={() => handleOpenChange(false)}
              />
            </Dialog.Overlay>

            {/* Sheet 面板 */}
            <Dialog.Content asChild>
              <motion.div
                className="sftp-sheet"
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 隐藏的标题和描述（无障碍要求） */}
                <VisuallyHidden.Root>
                  <Dialog.Title>SFTP File Manager</Dialog.Title>
                  <Dialog.Description>
                    SFTP file manager for uploading and managing remote files
                  </Dialog.Description>
                </VisuallyHidden.Root>

                {/* 拖动手柄（视觉提示） */}
                <div className="sftp-sheet__handle" />

                {/* 工具栏 */}
                <SFTPToolbar onClose={() => handleOpenChange(false)} />

                {/* 传输进度 */}
                <SFTPTransferProgress />

                {/* 上传任务列表 */}
                <SFTPUploadTasks />

                {/* 下载任务列表 */}
                <SFTPDownloadTasks />

                {/* 文件列表 */}
                <SFTPFileList />
              </motion.div>
            </Dialog.Content>
          </>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

SFTPSheet.displayName = 'SFTPSheet';

// ==================== 导出便捷 Hook ====================

/**
 * 使用 SFTP Sheet 的便捷 Hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const sftpSheet = useSFTPSheetControl();
 *
 *   return (
 *     <>
 *       <button onClick={() => sftpSheet.open('session-123')}>
 *         打开文件管理器
 *       </button>
 *       <SFTPSheet />
 *     </>
 *   );
 * }
 * ```
 */
export function useSFTPSheetControl() {
  const { openSheet, closeSheet, isOpen } = useSFTPSheet();

  return {
    isOpen,
    open: (sessionId: string, connectionConfig: SFTPConnectConfig, initialPath?: string) => {
      openSheet(sessionId, connectionConfig, initialPath);
    },
    close: closeSheet,
    toggle: () => {
      if (isOpen) {
        closeSheet();
      }
    },
  };
}
