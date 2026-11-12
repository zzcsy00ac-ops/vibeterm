/**
 * StreamingCommandOutput - 流式命令输出显示组件
 *
 * 实时显示命令执行输出，通过 Tauri 事件接收流式数据
 */

import { useEffect, useState, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { X } from 'lucide-react';
import './StreamingCommandOutput.css';

interface ToolOutputEvent {
  session_id: string;
  output_type: 'Stdout' | 'Stderr' | 'Success' | 'Error';
  data: string;
  timestamp: number;
}

interface StreamingCommandOutputProps {
  sessionId: string;
  command: string;
  onClose: () => void;
}

export function StreamingCommandOutput({
  sessionId,
  command,
  onClose,
}: StreamingCommandOutputProps) {
  const [output, setOutput] = useState<Array<{ type: string; text: string }>>([]);
  const [isRunning, setIsRunning] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: UnlistenFn;

    listen<ToolOutputEvent>(`tool-output://${sessionId}`, (event) => {
      const { output_type, data } = event.payload;
      setOutput((prev) => [...prev, { type: output_type, text: data }]);

      // 检测是否结束
      if (output_type === 'Success' || output_type === 'Error') {
        setIsRunning(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [sessionId]);

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="streaming-output">
      <div className="streaming-output-header">
        <span className="command">{command}</span>
        <div className="header-right">
          {isRunning ? <span className="status-running">● 运行中</span> : null}
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="streaming-output-body" ref={outputRef}>
        {output.length === 0 && isRunning && (
          <span className="output-waiting">等待输出...</span>
        )}
        {output.map((line, i) => (
          <span
            key={i}
            className={`output-line output-${line.type.toLowerCase()}`}
          >
            {line.text}
          </span>
        ))}
      </div>
    </div>
  );
}
