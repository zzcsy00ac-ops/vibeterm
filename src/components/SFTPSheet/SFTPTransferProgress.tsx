/**
 * SFTP 传输进度组件
 *
 * 显示文件下载进度
 * 注意：上传进度现在由 SFTPUploadTasks 组件管理
 */

import { type FC } from 'react';
import { useSFTPSheet } from '../../store/sftpStore';
import './SFTPTransferProgress.css';

export const SFTPTransferProgress: FC = () => {
  const { } = useSFTPSheet();

  // 下载进度由 SFTPDownloadTasks 组件处理，这里不再显示
  // 只返回空的占位元素保持布局一致
  return <div className="sftp-transfer-progress sftp-transfer-progress__empty" />;
};

SFTPTransferProgress.displayName = 'SFTPTransferProgress';
