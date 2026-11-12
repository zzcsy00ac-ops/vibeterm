/**
 * TextPart - 文本消息组件
 *
 * 用于渲染消息流中的文本部分
 */

import { MarkdownMessage } from '../ChatInterface/MarkdownMessage';

interface TextPartProps {
  text: string;
}

export function TextPart({ text }: TextPartProps) {
  return <MarkdownMessage content={text} isStreaming={false} />;
}
