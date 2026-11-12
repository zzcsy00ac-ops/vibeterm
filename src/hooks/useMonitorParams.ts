/**
 * 监控窗口参数解析 Hook
 *
 * 从 URL 查询参数中解析监控所需的会话信息
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface MonitorParams {
  /** SSH 会话 ID */
  sessionId: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  username: string;
  /** 私钥文件路径（可选，用于密钥认证） */
  privateKeyPath?: string;
  /** 参数是否有效 */
  isValid: boolean;
}

/**
 * 解析监控窗口 URL 参数
 *
 * @example
 * // URL: /monitor?sessionId=abc&host=192.168.1.1&port=22&username=root
 * const { sessionId, host, port, username, isValid } = useMonitorParams();
 */
export function useMonitorParams(): MonitorParams {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const sessionId = searchParams.get('sessionId') || '';
    const host = searchParams.get('host') || '';
    const portStr = searchParams.get('port');
    const username = searchParams.get('username') || '';
    const privateKeyPath = searchParams.get('privateKeyPath') || undefined;

    const port = portStr ? parseInt(portStr, 10) : 22;
    const isValid = !!(sessionId && host && username && !isNaN(port));

    return {
      sessionId,
      host,
      port,
      username,
      privateKeyPath,
      isValid,
    };
  }, [searchParams]);
}
