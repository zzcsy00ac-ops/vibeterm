/**
 * 全局 SFTP Sheet 容器
 *
 * 在 MainContent 中渲染，通过 Portal 挂载到 .app-container
 * Sheet 位置自动对齐到 MainContent 区域
 */

import { FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useSFTPSheet } from '../../store/sftpStore';
import { SFTPToolbar } from './SFTPToolbar';
import { SFTPTransferProgress } from './SFTPTransferProgress';
import { SFTPUploadTasks } from '../SFTPUploadTasks/SFTPUploadTasks';
import { SFTPDownloadTasks } from '../SFTPDownloadTasks/SFTPDownloadTasks';
import { SFTPFileList } from './SFTPFileList';
import './SFTPSheet.css';

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
    },
  },
  exit: {
    y: '100%' as const,
    opacity: 0,
    transition: {
      type: 'tween' as const,
      duration: 0.2,
    },
  },
};

// ==================== 组件 ====================

export const GlobalSFTPSheet: FC = () => {
  const {
    isOpen,
    closeSheet,
    initProgressListeners,
  } = useSFTPSheet();

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const [sheetStyle, setSheetStyle] = useState<React.CSSProperties>({});

  // 获取 .app-container 作为 Portal 挂载点
  useEffect(() => {
    const container = document.querySelector('.app-container') as HTMLElement;
    if (container) {
      setPortalContainer(container);
    }
  }, []);

  // 动态计算 Sheet 位置
  useEffect(() => {
    const updatePosition = () => {
      // 查找 .main-container (MainContent 的根元素)
      const mainContainer = document.querySelector('.main-container') as HTMLElement;
      if (!mainContainer) return;

      const rect = mainContainer.getBoundingClientRect();

      setSheetStyle({
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    };

    updatePosition();

    // 监听大小变化
    const resizeObserver = new ResizeObserver(updatePosition);
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      resizeObserver.observe(mainContainer);
    }

    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  // 初始化进度监听（复用现有逻辑）
  useEffect(() => {
    if (isOpen) {
      // sessionId 变化时重新注册监听器
      const sessionId = useSFTPSheet.getState().sessionId;
      if (lastSessionIdRef.current !== sessionId) {
        lastSessionIdRef.current = sessionId;
        const cleanup = initProgressListeners();
        return cleanup;
      }
    } else {
      lastSessionIdRef.current = null;
    }
  }, [isOpen, initProgressListeners]);

  // 渲染到 .app-container，避免被 MainContent 的 overflow: hidden 裁剪
  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeSheet()} modal={false}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <Dialog.Overlay asChild>
              <motion.div
                className="sftp-overlay"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={() => closeSheet()}
              />
            </Dialog.Overlay>

            {/* Sheet 面板 */}
            <Dialog.Content asChild>
              <motion.div
                className="sftp-sheet"
                style={sheetStyle}
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 隐藏的标题和描述 */}
                <VisuallyHidden.Root>
                  <Dialog.Title>SFTP File Manager</Dialog.Title>
                  <Dialog.Description>
                    SFTP file manager for uploading and managing remote files
                  </Dialog.Description>
                </VisuallyHidden.Root>

                {/* 拖动手柄 */}
                <div className="sftp-sheet__handle" />

                {/* 工具栏 */}
                <SFTPToolbar onClose={() => closeSheet()} />

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
    </Dialog.Root>,
    portalContainer
  );
};

GlobalSFTPSheet.displayName = 'GlobalSFTPSheet';
