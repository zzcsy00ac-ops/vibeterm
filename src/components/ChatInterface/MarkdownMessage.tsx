/**
 * MarkdownMessage - Markdown 消息渲染组件（性能优化版）
 *
 * 使用块级 Memoization 实现流式 Markdown 渲染：
 * - 将 Markdown 内容分割成独立的块
 * - 每个块独立 memoized，只更新变化的部分
 * - 只有最后一块在流式时启用动画
 *
 * 性能优化原理：
 * 1. 使用 marked.lexer() 将内容分割成块
 * 2. 每个块使用独立的 memoized 组件
 * 3. 已完成的内容块完全不重渲染
 * 4. 只有当前活跃块参与 reconcilation
 */

import { memo, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { marked, type Tokens } from 'marked';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { createMermaidPlugin, type DiagramPlugin } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import type { BundledTheme } from 'shiki';
import { useTheme } from '../ThemeProvider/ThemeProvider';
import './MarkdownMessage.css';
import 'katex/dist/katex.min.css';

/**
 * MarkdownMessage 组件属性
 */
export interface MarkdownMessageProps {
  /** Markdown 内容 */
  content: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 代码高亮主题（light + dark） */
  theme?: [BundledTheme, BundledTheme];
}

/**
 * Markdown 块类型
 */
interface MarkdownBlock {
  /** 块的唯一标识 */
  id: string;
  /** 块的原始内容 */
  content: string;
  /** 块类型 */
  type: string;
}

/**
 * 代码主题配置
 * One Dark Pro - 高对比度主题，符号清晰
 */
const defaultTheme: [BundledTheme, BundledTheme] = ['light-plus', 'one-dark-pro'];

/**
 * Mermaid 主题配置
 * 根据应用主题自动选择对应的 Mermaid 图表主题
 * Mermaid 支持的主题: 'default' | 'forest' | 'dark' | 'neutral' | 'base'
 */
type MermaidTheme = 'default' | 'dark';

function getMermaidThemeByAppearance(appearance: 'light' | 'dark'): MermaidTheme {
  // Light 模式使用 'default' 主题，Dark 模式使用 'dark' 主题
  return appearance === 'dark' ? 'dark' : 'default';
}

/**
 * 创建配置好的 Mermaid 插件
 *
 * 注意：此函数仅用于非缓存的 Streamdown 渲染路径。
 * 缓存的 Mermaid 渲染使用 CachedMermaidBlock 组件（全局实例管理）。
 *
 * @deprecated 阶段二优化后，主要渲染路径使用 CachedMermaidBlock
 */
function createConfiguredMermaidPlugin(theme: MermaidTheme): DiagramPlugin {
  return createMermaidPlugin({
    config: {
      theme: theme,
      startOnLoad: false,
      securityLevel: 'strict',
      fontFamily: 'monospace',
      logLevel: 'fatal',         // 进一步减少日志：仅在严重错误时输出
      suppressErrorRendering: true, // 抑制错误渲染（流式时不完整图表的错误）

      // Flowchart 流程图（最常用）
      flowchart: {
        // 使用默认 dagre 渲染器（比 ELK 快 4-8 倍）
        nodeSpacing: 35,
        rankSpacing: 35,
        curve: 'linear',
        padding: 15,
        htmlLabels: false,
      },

      // Sequence 序列图
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        actorMargin: 50,
        mirrorActors: true,
        showSequenceNumbers: false,
      },

      // Class 类图
      class: {
        hideEmptyMembersBox: true,
      },

      // State 状态图
      state: {},

      // ER 实体关系图
      er: {},

      // Gantt 甘特图
      gantt: {
        barHeight: 30,
        barGap: 4,
        topPadding: 30,
        gridLineStartPadding: 30,
        titleTopMargin: 10,
      },

      // Pie 饼图
      pie: {
        textPosition: 0.5,
      },

      // Journey 用户旅程图
      journey: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        leftMargin: 150,
        width: 250,
        height: 60,
        boxMargin: 10,
      },

      // GitGraph Git 图
      gitGraph: {
        showCommitLabel: false,
        showBranches: true,
      },

      // Mindmap 思维导图
      mindmap: {
        padding: 15,
      },

      // Sankey 桑基图
      sankey: {
        showValues: false,
      },

      // Timeline 时间线
      timeline: {
        diagramMarginX: 50,
        diagramMarginY: 10,
      },

      // Architecture 架构图
      architecture: {},

      // XYChart 柱状图/折线图（支持 bar 和 line 数据）
      xyChart: {
        width: 700,              // 图表宽度（像素）
        height: 400,             // 图表高度（像素）
        showDataLabel: false,    // 性能优化：不显示数据标签（大数据集时）
        plotReservedSpacePercent: 50,  // 为轴标签预留空间
      },

      // Radar 雷达图（beta 功能）
      radar: {
        // 雷达图使用默认配置，保持性能优化
        // 具体配置项由 mermaid 内部管理
      },
    },
  });
}

/**
 * 配置 marked
 */
marked.setOptions({
  gfm: true,      // GitHub Flavored Markdown
  breaks: true,   // 支持单个换行符
});

/**
 * 将 Markdown 分割成稳定的块
 *
 * 使用 marked.lexer() 进行词法分析，将 Markdown 内容分割成独立的块。
 * 每个块都有稳定的 ID，用于 React 的 key 和 memoization。
 *
 * @param markdown - Markdown 内容
 * @returns 块数组
 */
function parseMarkdownIntoBlocks(markdown: string): MarkdownBlock[] {
  // 空内容处理
  if (!markdown.trim()) {
    return [];
  }

  try {
    const tokens = marked.lexer(markdown) as Tokens.Generic[];
    const blocks: MarkdownBlock[] = [];
    let blockIndex = 0;

    tokens.forEach((token) => {
      // 跳过没有 raw 内容的 token（如 links 定义）
      if (!token.raw) return;

      // 为每个块生成稳定的 ID
      // 使用索引和类型组合，确保相同位置的块有相同的 ID
      const blockId = `${blockIndex}-${token.type}`;

      blocks.push({
        id: blockId,
        content: token.raw,
        type: token.type,
      });

      blockIndex++;
    });

    return blocks;
  } catch (error) {
    // 解析失败时返回单个块（兜底）
    console.error('[MarkdownMessage] Failed to parse markdown:', error);
    return [{
      id: 'fallback',
      content: markdown,
      type: 'paragraph',
    }];
  }
}

/**
 * 检测内容是否包含 Mermaid 图表
 */
function hasMermaidChart(content: string): boolean {
  return /^\s*```mermaid\s*\n/im.test(content);
}

/**
 * 验证 Mermaid 图表是否完整（用于流式渲染）
 * 只有完整的图表才应该被渲染，避免流式过程中的解析错误
 */
function isMermaidDiagramComplete(content: string): boolean {
  // 检查是否有完整的 mermaid 代码块
  const mermaidBlockMatch = content.match(/```mermaid\s*\n([\s\S]*?)```/g);
  if (!mermaidBlockMatch) return false;

  // 检查每个 mermaid 块是否闭合
  for (const block of mermaidBlockMatch) {
    // 基本验证：必须有起始和结束标记
    if (!block.includes('```')) return false;

    // 提取图表内容
    const match = block.match(/```mermaid\s*\n([\s\S]*?)```/);
    if (!match) return false;

    const diagramContent = match[1].trim();

    // 检查是否为空（流式中间状态）
    if (diagramContent.length === 0) return false;

    // 检查是否有有效的图表类型声明
    // 常见类型: graph, flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, pie, journey, gitGraph, mindmap, sankey, timeline, architecture, xychart, radar
    const validTypes = [
      'graph', 'flowchart',
      'sequenceDiagram', 'sequence',
      'classDiagram', 'class',
      'stateDiagram', 'state',
      'erDiagram', 'er',
      'gantt',
      'pie',
      'journey',
      'gitGraph',
      'mindmap',
      'sankey',
      'timeline',
      'architecture',
      'block', 'blockDiagram',
      'xychart', 'xyChart',    // 柱状图/折线图
      'radar', 'radar-beta',   // 雷达图（beta）
    ];

    const hasValidType = validTypes.some(type =>
      diagramContent.startsWith(type + ' ') ||
      diagramContent.startsWith(type + '\n') ||
      diagramContent.startsWith(type + '\t') ||
      diagramContent === type
    );

    if (!hasValidType) return false;
  }

  return true;
}

/**
 * LazyMermaidBlock - Mermaid 图表懒加载组件
 *
 * 使用 Intersection Observer API 实现视口检测，
 * 只有当图表即将进入视口时才开始渲染，提升首屏加载性能。
 *
 * 阶段二优化：使用 Streamdown 渲染，但 mermaid.render() 被拦截以应用缓存。
 * 这样保留了全屏、缩放等控件功能。
 *
 * 阶段三优化：流式渲染时，仅当图表完整时才渲染，避免解析错误。
 */
const LazyMermaidBlock = memo(
  ({ content, shikiTheme, mermaidPlugin, isStreaming }: MarkdownBlockProps) => {
    const { ref, inView } = useInView({
      triggerOnce: true, // 只触发一次
      rootMargin: '200px 0px', // 提前 200px 开始加载
      threshold: 0,
    });

    // 流式渲染时检查图表是否完整
    const isDiagramComplete = !isStreaming || isMermaidDiagramComplete(content);
    const shouldRender = inView && isDiagramComplete;

    return (
      <div ref={ref} style={{ minHeight: inView ? 'auto' : '150px' }}>
        {shouldRender ? (
          <Streamdown
            plugins={{ code, mermaid: mermaidPlugin, math, cjk }}
            shikiTheme={shikiTheme}
            mode="static"
            isAnimating={false}
            controls={{
              code: true,
              mermaid: {
                download: false,
                copy: true,
                fullscreen: true,
                panZoom: true,
              },
            }}
          >
            {content}
          </Streamdown>
        ) : (
          <div
            className="mermaid-placeholder"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '150px',
              background: 'var(--gray-a3)',
              borderRadius: '8px',
              color: 'var(--gray-a11)',
              fontSize: '14px',
            }}
          >
            <span>{isStreaming && !isDiagramComplete ? '图表生成中...' : '图表加载中...'}</span>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.shikiTheme[0] === nextProps.shikiTheme[0] &&
      prevProps.shikiTheme[1] === nextProps.shikiTheme[1] &&
      prevProps.mermaidTheme === nextProps.mermaidTheme
    );
  }
);

LazyMermaidBlock.displayName = 'LazyMermaidBlock';

/**
 * MarkdownBlock 组件 - 单个块的 memoized 组件
 *
 * 每个 Markdown 块独立渲染，只有内容真正改变时才重渲染。
 * 使用自定义比较函数确保精确的 memoization。
 */
interface MarkdownBlockProps {
  content: string;
  isStreaming: boolean;
  shikiTheme: [BundledTheme, BundledTheme];
  mermaidPlugin: DiagramPlugin;
  mermaidTheme: MermaidTheme;
}

const MarkdownBlock = memo(
  ({ content, isStreaming, shikiTheme, mermaidPlugin, mermaidTheme }: MarkdownBlockProps) => {
    // 检测是否包含 Mermaid 图表，如果包含则使用懒加载
    const containsMermaid = hasMermaidChart(content);

    if (containsMermaid) {
      return (
        <LazyMermaidBlock
          content={content}
          isStreaming={isStreaming}
          shikiTheme={shikiTheme}
          mermaidPlugin={mermaidPlugin}
          mermaidTheme={mermaidTheme}
        />
      );
    }

    return (
      <Streamdown
        plugins={{code:code,mermaid:mermaidPlugin,math,cjk}}
        shikiTheme={shikiTheme}
        mode={isStreaming ? 'streaming' : 'static'}
        isAnimating={isStreaming}
        controls={{
          code: true,      // 保留代码复制按钮
          mermaid: {
            download: false,  // 禁用下载按钮
            copy: true,       // 保留复制按钮
            fullscreen: true, // 保留全屏按钮
            panZoom: true,    // 保留缩放控件
          },
        }}
      >
        {content}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数：只有内容或流式状态真正改变时才重渲染
    return (
      prevProps.content === nextProps.content &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.shikiTheme[0] === nextProps.shikiTheme[0] &&
      prevProps.shikiTheme[1] === nextProps.shikiTheme[1] &&
      prevProps.mermaidTheme === nextProps.mermaidTheme
    );
  }
);

MarkdownBlock.displayName = 'MarkdownBlock';

/**
 * MarkdownMessage 组件
 *
 * 性能优化：
 * - 使用 useMemo 缓存块分割结果
 * - 每个块独立 memoized
 * - 只有最后一块在流式时启用动画
 * - 历史消息使用 static 模式
 *
 * @example
 * ```tsx
 * <MarkdownMessage
 *   content="# Hello\n\nThis is **bold** text."
 *   isStreaming={true}
 * />
 * ```
 */
export const MarkdownMessage = memo(
  ({ content, isStreaming = false, theme }: MarkdownMessageProps) => {
    const finalTheme = theme ?? defaultTheme;

    // 获取当前应用主题外观
    const appearance = useTheme();

    // 根据 application 主题创建对应的 Mermaid 插件配置
    const mermaidTheme = useMemo(
      () => getMermaidThemeByAppearance(appearance),
      [appearance]
    );

    const mermaidPlugin = useMemo(
      () => createConfiguredMermaidPlugin(mermaidTheme),
      [mermaidTheme]
    );

    // 缓存块分割结果，避免每次渲染都重新解析
    const blocks = useMemo(
      () => parseMarkdownIntoBlocks(content),
      [content]
    );

    // 空内容处理
    if (blocks.length === 0) {
      return null;
    }

    return (
      <div className="markdown-message rounded px-5 py-1">
        {blocks.map((block, index) => {
          // 只有最后一块且正在流式时启用动画
          const isBlockStreaming = isStreaming && index === blocks.length - 1;

          return (
            <MarkdownBlock
              key={block.id}
              content={block.content}
              isStreaming={isBlockStreaming}
              shikiTheme={finalTheme}
              mermaidPlugin={mermaidPlugin}
              mermaidTheme={mermaidTheme}
            />
          );
        })}
      </div>
    );
  },
  // 自定义比较函数：只有内容或流式状态真正改变时才重渲染
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.theme?.[0] === nextProps.theme?.[0] &&
      prevProps.theme?.[1] === nextProps.theme?.[1]
    );
  }
);

MarkdownMessage.displayName = 'MarkdownMessage';
