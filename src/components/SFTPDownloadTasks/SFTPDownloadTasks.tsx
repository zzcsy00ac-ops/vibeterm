/**
 * SFTP 下载任务列表组件
 *
 * 显示当前下载任务的列表，包括：
 * - 任务状态（下载中、已完成、失败）
 * - 进度条
 * - 错误信息（如果有）
 * - 清理已完成任务按钮
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Check, X, Loader2 } from 'lucide-react';
import { useSFTPSheet } from '../../store/sftpStore';
import type { DownloadTask } from '../../store/sftpStore';
import './SFTPDownloadTasks.css';

// ==================== 状态图标组件 ====================

interface StatusIconProps {
  status: DownloadTask['status'];
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case 'downloading':
      return <Loader2 className="status-icon status-downloading" size={16} />;
    case 'completed':
      return <Check className="status-icon status-completed" size={16} />;
    case 'failed':
      return <X className="status-icon status-failed" size={16} />;
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

interface DownloadTaskItemProps {
  task: DownloadTask;
}

const DownloadTaskItem: React.FC<DownloadTaskItemProps> = ({ task }) => {
  const { t } = useTranslation();

  const statusText = useMemo(() => {
    return t(`sftp.download.status.${task.status}`);
  }, [task.status, t]);

  return (
    <div className={`download-task-item status-${task.status}`}>
      <div className="task-header">
        <StatusIcon status={task.status} />
        <span className="task-name" title={task.fileName}>
          {task.status === 'completed' ? <Download size={14} className="task-type-icon" /> : null}
          {task.fileName}
        </span>
        <span className="task-status">{statusText}</span>
      </div>

      {task.status === 'downloading' ? (
        <div className="task-progress">
          <ProgressBar progress={task.progress} />
        </div>
      ) : null}

      {(task.status === 'failed' && task.error) ? (
        <div className="task-error" title={task.error}>
          {task.error}
        </div>
      ) : null}
    </div>
  );
};

// ==================== 主组件 ====================

export const SFTPDownloadTasks: React.FC = () => {
  const { downloadTasks, clearCompletedDownloads, sessionId } = useSFTPSheet();
  const { t } = useTranslation();

  // 将 Map 转换为数组，过滤出当前 session 的任务，并按创建时间排序
  const tasks = useMemo(() => {
    return Array.from(downloadTasks.values())
      .filter(task => task.sessionId === sessionId)  // 只显示当前 session 的任务
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [downloadTasks, sessionId]);

  // 检查是否有已完成的任务
  const hasCompletedTasks = useMemo(() => {
    return tasks.some(task => task.status === 'completed');
  }, [tasks]);

  // 如果没有任务，不显示组件
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="download-tasks-panel">
      <div className="download-tasks-list">
        {tasks.map(task => (
          <DownloadTaskItem key={task.id} task={task} />
        ))}
      </div>

      {hasCompletedTasks && (
        <button
          className="clear-completed-btn"
          onClick={clearCompletedDownloads}
        >
          {t('sftp.download.clearCompleted')}
        </button>
      )}
    </div>
  );
};

export default SFTPDownloadTasks;
