import { FileKey, Trash2, Plus } from 'lucide-react';
import { open } from '../../lib/tauri-api';
import './PrivateKeySection.css';

export interface PrivateKeySectionProps {
  privateKeyPath?: string;
  onKeyChange: (path: string | undefined) => void;
  onRefresh?: () => void;
}

export function PrivateKeySection({
  privateKeyPath,
  onKeyChange,
}: PrivateKeySectionProps) {
  const handleSelectKey = async () => {
    try {
      const selected = await open({
        title: 'Select Private Key',
        multiple: false,
        // 不使用过滤器，因为 SSH 私钥通常没有扩展名（如 id_rsa, id_ed25519）
      });

      if (selected && typeof selected === 'string') {
        onKeyChange(selected);
      }
    } catch {
      // 选择文件失败，忽略
    }
  };

  const handleRemoveKey = () => {
    onKeyChange(undefined);
  };

  return (
    <div className="private-key-section">
      <label className="section-label">Private key</label>

      {privateKeyPath ? (
        // 已添加私钥
        <div className="key-status-saved">
          <FileKey size={16} className="key-icon" />
          <span className="key-path" title={privateKeyPath}>
            {privateKeyPath}
          </span>
          <button
            className="remove-key-btn"
            onClick={handleRemoveKey}
            title="Remove private key"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        // 未添加私钥
        <button
          className="add-key-btn"
          onClick={handleSelectKey}
        >
          <Plus size={14} />
          Add a private key...
        </button>
      )}

      {/* 私钥密码短语提示 */}
      {privateKeyPath && (
        <div className="key-passphrase-hint">
          <p className="hint-text">
            If your private key is protected with a passphrase,
            you'll be prompted to enter it when connecting.
          </p>
        </div>
      )}
    </div>
  );
}
