/**
 * SFTP 上传任务列表组件
 *
 * 显示当前上传任务的列表，包括：
 * - 任务状态（待上传、上传中、已完成、失败）
 * - 进度条
 * - 错误信息（如果有）
 * - 清理已完成任务按钮
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, ArrowUp, Check, X, XCircle, Clock, Loader2 } from 'lucide-react';
import { useSFTPSheet } from '../../store/sftpStore';
import type { UploadTask } from '../../store/sftpStore';
import './SFTPUploadTasks.css';

// ==================== 状态图标组件 ====================

interface StatusIconProps {
  status: UploadTask['status'];
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock className="status-icon status-pending" size={16} />;
    case 'uploading':
      return <Loader2 className="status-icon status-uploading" size={16} />;
    case 'completed':
      return <Check className="status-icon status-completed" size={16} />;
    case 'failed':
      return <X className="status-icon status-failed" size={16} />;
    case 'cancelled':
      return <XCircle className="status-icon status-cancelled" size={16} />;
    default:
      return null;
  }
};

// ==================== 进度条组件 ====================

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="progress-bar-container">
      <div
        className="progress-bar-fill"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
      <span className="progress-text">{Math.round(progress)}%</span>
    </div>
  );
};

// ==================== 任务项组件 ====================

interface UploadTaskItemProps {
  task: UploadTask;
}

const UploadTaskItem: React.FC<UploadTaskItemProps> = ({ task }) => {
  const { t } = useTranslation();
  const { cancelUpload, retryUpload } = useSFTPSheet();

  const statusText = useMemo(() => {
    return t(`sftp.upload.status.${task.status}`);
  }, [task.status, t]);

  const handleCancel = () => {
    cancelUpload(task.id);
  };

  const handleRetry = () => {
    retryUpload(task.id, false); // 从头开始重试
  };

  const handleResume = () => {
    retryUpload(task.id, true); // 断点续传
  };

  return (
    <div className={`upload-task-item status-${task.status}`}>
      <div className="task-header">
        <StatusIcon status={task.status} />
        <span className="task-name" title={task.fileName}>
          {task.status === 'completed' ? <Upload size={14} className="task-type-icon" /> : null}
          {task.fileName}
        </span>
        <span className="task-status">{statusText}</span>
        {(task.status === 'uploading' || task.status === 'pending') && (
          <button
            className="task-cancel-btn"
            onClick={handleCancel}
            title={t('sftp.upload.cancel')}
            aria-label={t('sftp.upload.cancel')}
          >
            <X size={14} />
          </button>
        )}
        {(task.status === 'failed' || task.status === 'cancelled') && (
          <div className="task-retry-buttons">
            <button
              className="task-retry-btn"
              onClick={handleRetry}
              title={t('sftp.upload.retry')}
              aria-label={t('sftp.upload.retry')}
            >
              <Upload size={14} />
            </button>
            {task.uploadedBytes && task.uploadedBytes > 0 && (
              <button
                className="task-resume-btn"
                onClick={handleResume}
                title={t('sftp.upload.resume')}
                aria-label={t('sftp.upload.resume')}
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {task.status === 'uploading' && (
        <div className="task-progress">
          <ProgressBar progress={task.progress} />
        </div>
      )}

      {task.status === 'failed' && task.error && (
        <div className="task-error" title={task.error}>
          {task.error}
        </div>
      )}
    </div>
  );
};

// ==================== 主组件 ====================

export const SFTPUploadTasks: React.FC = () => {
  const { uploadTasks, uploadQueue, activeUploads, clearCompletedTasks, sessionId } = useSFTPSheet();
  const { t } = useTranslation();

  // 将 Map 转换为数组，过滤出当前 session 的任务，并按创建时间排序
  const tasks = useMemo(() => {
    return Array.from(uploadTasks.values())
      .filter(task => task.sessionId === sessionId)  // 只显示当前 session 的任务
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [uploadTasks, sessionId]);

  // 检查是否有已完成的任务
  const hasCompletedTasks = useMemo(() => {
    return tasks.some(task => task.status === 'completed');
  }, [tasks]);

  // 计算队列中的任务数和上传中的任务数
  const queueStatus = useMemo(() => {
    const queuedCount = uploadQueue.length;
    const uploadingCount = activeUploads;
    return { queuedCount, uploadingCount };
  }, [uploadQueue, activeUploads]);

  // 如果没有任务，不显示组件
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="upload-tasks-panel">
      {/* 队列状态显示 */}
      {(queueStatus.queuedCount > 0 || queueStatus.uploadingCount > 0) && (
        <div className="upload-queue-status">
          {queueStatus.uploadingCount > 0 && (
            <span>{t('sftp.upload.queueStatus.uploading', { count: queueStatus.uploadingCount })}</span>
          )}
          {queueStatus.uploadingCount > 0 && queueStatus.queuedCount > 0 && ', '}
          {queueStatus.queuedCount > 0 && (
            <span>{t('sftp.upload.queueStatus.queued', { count: queueStatus.queuedCount })}</span>
          )}
        </div>
      )}

      <div className="upload-tasks-list">
        {tasks.map(task => (
          <UploadTaskItem key={task.id} task={task} />
        ))}
      </div>

      {hasCompletedTasks && (
        <button
          className="clear-completed-btn"
          onClick={clearCompletedTasks}
        >
          {t('sftp.upload.clearCompleted')}
        </button>
      )}
    </div>
  );
};

export default SFTPUploadTasks;
