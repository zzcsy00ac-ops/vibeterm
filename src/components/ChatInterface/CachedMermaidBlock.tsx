/**
 * CachedMermaidBlock - 带缓存的 Mermaid 图表组件
 *
 * 优先从缓存读取 SVG，缓存未命中时调用 Mermaid 渲染。
 * 渲染完成后自动存入缓存，实现重复图表毫秒级加载。
 */

import { memo, useState, useEffect } from 'react';
import { getMermaidInstance, type MermaidTheme } from '../../utils/mermaid/mermaidInstance';
import { getCachedMermaid, setCachedMermaid } from '../../utils/mermaid/mermaidCache';

/**
 * 组件属性
 */
export interface CachedMermaidBlockProps {
  /** Markdown 内容（包含 ```mermaid 代码块） */
  content: string;
  /** Mermaid 主题 */
  theme: MermaidTheme;
}

/**
 * 从 Markdown 内容中提取 Mermaid 代码
 *
 * @param content - Markdown 内容
 * @returns Mermaid 代码，如果未找到则返回 null
 */
function extractMermaidCode(content: string): string | null {
  // 匹配 ```mermaid ... ``` 代码块
  const match = content.match(/^\s*```mermaid\s*\n([\s\S]*?)```/im);
  return match ? match[1].trim() : null;
}

/**
 * CachedMermaidBlock 组件
 */
export const CachedMermaidBlock = memo<CachedMermaidBlockProps>(
  function CachedMermaidBlock({ content, theme }) {
    const [svg, setSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let isCancelled = false;

      async function renderMermaid() {
        // 提取 Mermaid 代码
        const code = extractMermaidCode(content);
        if (!code) {
          if (!isCancelled) {
            setError('无效的 Mermaid 代码');
            setIsLoading(false);
          }
          return;
        }

        try {
          // 1. 尝试从缓存获取
          const cachedSvg = getCachedMermaid(code);
          if (cachedSvg) {
            if (!isCancelled) {
              setSvg(cachedSvg);
              setIsLoading(false);
              if (import.meta.env.DEV) {
                console.log('[CachedMermaidBlock] 缓存命中');
              }
            }
            return;
          }

          // 2. 缓存未命中，调用 Mermaid 渲染
          if (!isCancelled) {
            setIsLoading(true);
          }

          const mermaid = getMermaidInstance(theme);
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          if (import.meta.env.DEV) {
            console.log('[CachedMermaidBlock] 缓存未命中，开始渲染');
          }

          const { svg: renderedSvg } = await mermaid.render(id, code);

          if (isCancelled) return;

          // 3. 存入缓存
          setCachedMermaid(code, renderedSvg);

          // 4. 更新 UI
          setSvg(renderedSvg);
          setIsLoading(false);
          setError(null);
        } catch (err) {
          if (isCancelled) {
            return;
          }
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('[CachedMermaidBlock] 渲染失败:', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
        }
      }

      renderMermaid();

      return () => {
        isCancelled = true;
      };
    }, [content, theme]);

    // 加载状态
    if (isLoading) {
      return (
        <div
          className="mermaid-loading"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '150px',
            background: 'var(--gray-a3)',
            borderRadius: '8px',
            color: 'var(--gray-a11)',
            fontSize: '14px',
          }}
        >
          <span>图表渲染中...</span>
        </div>
      );
    }

    // 错误状态
    if (error) {
      return (
        <div
          className="mermaid-error"
          style={{
            padding: '16px',
            background: 'var(--red-a3)',
            borderRadius: '8px',
            color: 'var(--red-a11)',
            fontSize: '14px',
          }}
        >
          <strong>渲染失败：</strong> {error}
        </div>
      );
    }

    // 成功状态：渲染 SVG
    return (
      <div
        className="mermaid-chart"
        dangerouslySetInnerHTML={{ __html: svg || '' }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100px',
        }}
      />
    );
  },
  // 自定义比较函数：只有内容或主题真正改变时才重渲染
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.theme === nextProps.theme;
  }
);

CachedMermaidBlock.displayName = 'CachedMermaidBlock';
