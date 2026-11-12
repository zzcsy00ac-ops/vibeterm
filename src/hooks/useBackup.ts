/**
 * Backup Import/Export Hook
 *
 * Manages provider configuration backup and restore functionality
 */

import { useState, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { open } from '@tauri-apps/plugin-dialog';
import {
  exportProviders,
  importProviders,
  validateBackup,
  type BackupValidationResult,
} from '../command';

/**
 * Backup operation status
 */
export type BackupStatus =
  | 'idle'           // No operation in progress
  | 'exporting'      // Exporting data
  | 'importing'      // Importing data
  | 'validating'     // Validating backup
  | 'success'        // Operation completed successfully
  | 'error';         // Operation failed

/**
 * Backup operation type
 */
export type BackupOperation = 'export' | 'import' | 'validate';

/**
 * Backup state
 */
export interface BackupState {
  /** Current status */
  status: BackupStatus;
  /** Error message if status is error */
  error: string | null;
  /** Success message if status is success */
  message: string | null;
  /** Validation result (if applicable) */
  validationResult: BackupValidationResult | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
}

/**
 * useBackup hook return value
 */
export interface UseBackupReturn {
  /** Backup state */
  state: BackupState;
  /** Export providers to ZIP file */
  exportBackup: () => Promise<void>;
  /** Import providers from ZIP file */
  importBackup: (options?: { replaceExisting?: boolean }) => Promise<void>;
  /** Validate a backup file */
  validateBackupFile: () => Promise<BackupValidationResult | null>;
  /** Reset state to idle */
  reset: () => void;
}

/**
 * Backup Import/Export Hook
 */
export function useBackup(): UseBackupReturn {
  const [state, setState] = useState<BackupState>({
    status: 'idle',
    error: null,
    message: null,
    validationResult: null,
    isLoading: false,
  });

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      error: null,
      message: null,
      validationResult: null,
      isLoading: false,
    });
  }, []);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<BackupState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Export providers to ZIP file
   */
  const exportBackup = useCallback(async () => {
    try {
      updateState({
        status: 'exporting',
        error: null,
        message: null,
        isLoading: true,
      });

      // Show save dialog
      const filePath = await save({
        title: 'Export Backup',
        defaultPath: 'vibeterm-backup.zip',
        filters: [
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
      });

      if (filePath === null) {
        // User cancelled
        updateState({ status: 'idle', isLoading: false });
        return;
      }

      // Export providers
      const message = await exportProviders(filePath, true);

      updateState({
        status: 'success',
        message,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateState({
        status: 'error',
        error: errorMessage,
        isLoading: false,
      });
    }
  }, [updateState]);

  /**
   * Import providers from ZIP file
   */
  const importBackup = useCallback(async (options: { replaceExisting?: boolean } = {}) => {
    console.log('[Backup] importBackup called, options:', options);

    try {
      updateState({
        status: 'importing',
        error: null,
        message: null,
        isLoading: true,
      });

      console.log('[Backup] State set to importing, opening file dialog...');

      // Show open dialog
      const filePath = await open({
        title: 'Import Backup',
        multiple: false,
        filters: [
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
      });

      console.log('[Backup] File dialog result:', filePath);

      if (filePath === null || Array.isArray(filePath)) {
        // User cancelled or invalid selection
        console.log('[Backup] User cancelled or invalid selection, resetting state');
        updateState({ status: 'idle', isLoading: false });
        return;
      }

      console.log('[Backup] File selected:', filePath);

      // Validate backup first
      updateState({ status: 'validating' });
      console.log('[Backup] About to call validateBackup with path:', filePath);
      const validationResult = await validateBackup(filePath);

      console.log('[Backup] Validation result:', validationResult);
      console.log('[Backup] isValid type:', typeof validationResult.isValid);
      console.log('[Backup] isValid value:', validationResult.isValid);
      console.log('[Backup] !isValid:', !validationResult.isValid);
      console.log('[Backup] Message from backend:', validationResult.message);

      // Fix: explicitly convert to boolean and check
      const isValid = validationResult.isValid === true || (typeof validationResult.isValid === 'string' && validationResult.isValid === 'true');

      console.log('[Backup] Normalized isValid:', isValid);

      if (!isValid) {
        console.log('[Backup] Validation failed, setting error state');
        updateState({
          status: 'error',
          error: validationResult.message,
          validationResult,
          isLoading: false,
        });
        return;
      }

      console.log('[Backup] Validation passed, about to call importProviders...');

      // Import providers
      const message = await importProviders(
        filePath,
        options.replaceExisting ?? true
      );

      console.log('[Backup] Import completed, message:', message);

      updateState({
        status: 'success',
        message,
        validationResult,
        isLoading: false,
      });
      console.log('[Backup] State updated to success');
    } catch (error) {
      console.error('[Backup] Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[Backup] Setting error state:', errorMessage);
      updateState({
        status: 'error',
        error: errorMessage,
        isLoading: false,
      });
    }
  }, [updateState]);

  /**
   * Validate a backup file
   */
  const validateBackupFile = useCallback(async (): Promise<BackupValidationResult | null> => {
    try {
      updateState({
        status: 'validating',
        error: null,
        isLoading: true,
      });

      // Show open dialog
      const filePath = await open({
        title: 'Select Backup to Validate',
        multiple: false,
        filters: [
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
      });

      if (filePath === null || Array.isArray(filePath)) {
        // User cancelled or invalid selection
        updateState({ status: 'idle', isLoading: false });
        return null;
      }

      // Validate backup
      const validationResult = await validateBackup(filePath);

      updateState({
        status: validationResult.isValid ? 'success' : 'error',
        validationResult,
        isLoading: false,
      });

      return validationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateState({
        status: 'error',
        error: errorMessage,
        isLoading: false,
      });
      return null;
    }
  }, [updateState]);

  return {
    state,
    exportBackup,
    importBackup,
    validateBackupFile,
    reset,
  };
}
