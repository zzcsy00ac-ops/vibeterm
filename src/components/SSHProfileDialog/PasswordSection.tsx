import { useState, useRef, useEffect } from 'react';
import { Check, Key } from 'lucide-react';
import { setPassword, deletePassword, getPassword } from 'tauri-plugin-keyring-api';
import { PasswordDialog } from './PasswordDialog';
import { Dialog, type DialogRef } from '../Dialog';
import './PasswordSection.css';

export interface PasswordSectionProps {
  username?: string;
  host?: string;
  onPasswordSet: () => void;
  onPasswordForgotten: () => void;
}

/**
 * 生成 Keychain 服务名
 */
const getKeychainService = (username: string, host: string): string => {
  return `ssh:${username}@${host}`;
};

/**
 * 检查 Keychain 中是否存在密码
 */
const checkPasswordExists = async (username: string, host: string): Promise<boolean> => {
  const service = getKeychainService(username, host);
  try {
    const password = await getPassword(service, username);
    return !!password; // 转换为 boolean，过滤掉 undefined/null
  } catch {
    return false;
  }
};

export function PasswordSection({
  username,
  host,
  onPasswordSet,
  onPasswordForgotten,
}: PasswordSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogRef = useRef<DialogRef>(null);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);

  // 同步 Keychain 密码状态
  useEffect(() => {
    const syncPasswordStatus = async () => {
      if (!username || !host) {
        setHasSavedPassword(false);
        return;
      }
      const exists = await checkPasswordExists(username, host);
      setHasSavedPassword(exists);
    };

    syncPasswordStatus();
  }, [username, host]);

  // 删除密码
  const handleForgetPassword = async () => {
    if (!username || !host) return;

    const service = getKeychainService(username, host);

    dialogRef.current?.confirm({
      title: 'Forget Password',
      message: `Forget password for ${username}@${host}?`,
      type: 'warning',
      confirmText: 'Forget',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deletePassword(service, username);
        } catch {
          // 删除失败，忽略
        }

        // 重新检查 Keychain 状态并更新 Store
        const exists = await checkPasswordExists(username, host);
        setHasSavedPassword(exists);
        onPasswordForgotten();
      },
    });
  };

  // 保存密码
  const handleSetPassword = async (password: string) => {
    if (!username || !host) return;

    const service = getKeychainService(username, host);
    await setPassword(service, username, password);
    setHasSavedPassword(true);  // 立即更新状态
    onPasswordSet();
  };

  // 未输入用户名或主机时显示提示
  if (!username || !host) {
    return (
      <div className="password-section">
        <label className="section-label">Password</label>
        <div className="section-hint">
          Enter username and host first
        </div>
      </div>
    );
  }

  return (
    <div className="password-section">
      <label className="section-label">Password</label>

      {hasSavedPassword ? (
        <div className="password-status-saved">
          <Check size={16} className="success-icon" />
          <span className="status-text">Password is saved in keychain</span>
          <button className="forget-btn" onClick={handleForgetPassword}>
            Forget
          </button>
        </div>
      ) : (
        <div className="password-status-empty">
          <button
            className="set-password-btn"
            onClick={() => setIsDialogOpen(true)}
          >
            <Key size={14} />
            Set Password
          </button>
        </div>
      )}

      <PasswordDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        username={username}
        host={host}
        onConfirm={handleSetPassword}
      />

      <Dialog ref={dialogRef} nested={true} />
    </div>
  );
}
