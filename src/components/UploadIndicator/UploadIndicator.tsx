/**
 * UploadIndicator Component
 *
 * Displays upload progress inline in the terminal footer status bar
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Check, AlertTriangle } from 'lucide-react';
import { useSFTPSheet, type UploadSummary } from '../../store/sftpStore';
import { Dialog, type DialogRef } from '../Dialog';
import './UploadIndicator.css';

export interface UploadIndicatorProps {
  /** Session ID to filter uploads */
  sessionId: string;
}

/**
 * Custom hook to subscribe to upload tasks with proper reactivity
 */
function useUploadTasks(sessionId: string) {
  const store = useSFTPSheet;

  // Use useSyncExternalStore for proper reactivity with Map
  const uploadTasks = useSyncExternalStore(
    useCallback((onStoreChange) => {
      return store.subscribe((state) => {
        // Trigger change when uploadTasks Map reference changes
        if (state.uploadTasks) {
          onStoreChange();
        }
      });
    }, [store]),
    useCallback(() => store.getState().uploadTasks, [store]),
  );

  const getUploadSummary = useCallback(() => {
    return store.getState().getUploadSummary(sessionId);
  }, [store, sessionId]);

  const retryUpload = useCallback((taskId: string, resume: boolean) => {
    return store.getState().retryUpload(taskId, resume);
  }, [store]);

  const removeUploadTask = useCallback((taskId: string) => {
    return store.getState().removeUploadTask(taskId);
  }, [store]);

  return { uploadTasks, getUploadSummary, retryUpload, removeUploadTask };
}

/**
 * UploadIndicator shows upload progress inline in the footer
 */
export const UploadIndicator: React.FC<UploadIndicatorProps> = ({
  sessionId,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<DialogRef>(null);

  const [dismissed, setDismissed] = useState(false);
  const [lastStatus, setLastStatus] = useState<UploadSummary['status']>('idle');

  const { uploadTasks, getUploadSummary, retryUpload, removeUploadTask } = useUploadTasks(sessionId);

  // Get current upload summary
  const summary = getUploadSummary();

  // Get current uploading task (for individual file progress)
  const currentUploadingTask = Array.from(uploadTasks.values()).find(
    task => task.sessionId === sessionId && task.status === 'uploading'
  );

  // Current file progress (0-100)
  const currentProgress = currentUploadingTask?.progress ?? 0;

  // Reset dismissed when status changes from idle to something else
  useEffect(() => {
    if (summary.status !== 'idle' && lastStatus === 'idle') {
      setDismissed(false);
    }
    setLastStatus(summary.status);
  }, [summary.status, lastStatus]);

  // Auto-dismiss success after a delay
  useEffect(() => {
    if (summary.status === 'success' && !dismissed) {
      const timer = setTimeout(() => {
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [summary.status, dismissed]);

  // Get failed tasks for error dialog
  const failedTasks = Array.from(uploadTasks.values()).filter(
    task => task.sessionId === sessionId && (task.status === 'failed' || task.status === 'cancelled')
  );

  // Handle click on error state
  const handleClick = useCallback(() => {
    if (summary.status === 'failed' || summary.status === 'partial-failure') {
      // Build error content
      const errorItems = failedTasks.map(task => (
        <div key={task.id} className="upload-error-item">
          <span className="upload-error-item__name">{task.fileName}</span>
          <span className="upload-error-item__message">{task.error || 'Unknown error'}</span>
        </div>
      ));

      dialogRef.current?.confirm({
        title: t('terminal.upload.errorTitle', 'Upload Failed'),
        content: (
          <div className="upload-error-content">
            <p>{t('terminal.upload.errorIntro', 'The following file(s) failed to upload:')}</p>
            <div className="upload-error-list">
              {errorItems}
            </div>
          </div>
        ),
        confirmText: t('terminal.upload.retryFailed', 'Retry Failed'),
        cancelText: t('terminal.upload.skipAll', 'Skip All'),
        type: 'warning',
        onConfirm: () => {
          // Retry all failed tasks
          failedTasks.forEach(task => {
            retryUpload(task.id, false);
          });
        },
        onCancel: () => {
          // Remove all failed tasks
          failedTasks.forEach(task => {
            removeUploadTask(task.id);
          });
          setDismissed(true);
        },
      });
    }
  }, [summary.status, failedTasks, retryUpload, removeUploadTask, t]);

  // Don't render if idle or dismissed
  if (summary.status === 'idle' || dismissed) {
    return null;
  }

  // Success badge (inline)
  if (summary.status === 'success') {
    return (
      <span className="upload-indicator upload-indicator--success-badge">
        <Check size={12} />
        <span>{summary.completed}</span>
      </span>
    );
  }

  // Error state (inline, clickable)
  if (summary.status === 'failed' || summary.status === 'partial-failure') {
    return (
      <>
        <span
          className="upload-indicator upload-indicator--error-badge"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
          <AlertTriangle size={12} />
          <span>{summary.failed}</span>
        </span>
        <Dialog ref={dialogRef} />
      </>
    );
  }

  // Uploading state (inline with mini progress bar)
  return (
    <span className="upload-indicator upload-indicator--uploading-badge">
      <Upload size={12} />
      <span className="upload-indicator__mini-progress">
        <div
          className="upload-indicator__mini-progress-fill"
          style={{ width: `${currentProgress}%` }}
        />
      </span>
      <span className="upload-indicator__mini-text">
        {currentUploadingTask?.fileName
          ? (currentUploadingTask.fileName.length > 15
              ? `${currentUploadingTask.fileName.slice(0, 12)}...`
              : currentUploadingTask.fileName)
          : `${summary.uploading + summary.queued}`}
      </span>
    </span>
  );
};

export default UploadIndicator;
