/**
 * mermaidInstance - 全局 Mermaid 实例管理器
 *
 * 使用单例模式管理 Mermaid 实例，避免重复初始化开销。
 * 支持主题切换，当主题变化时重新初始化实例。
 * 阶段二优化：拦截 mermaid.render() 调用，添加缓存层。
 */

import mermaid from 'mermaid';
import { getCachedMermaid, setCachedMermaid, clearMermaidCache } from './mermaidCache';

/**
 * Mermaid 主题类型
 */
export type MermaidTheme = 'default' | 'dark';

/**
 * Mermaid 实例管理器状态
 */
interface MermaidInstanceState {
  instance: typeof mermaid;
  theme: MermaidTheme;
  initialized: boolean;
}

// 全局实例状态
let state: MermaidInstanceState | null = null;

/**
 * 原始 render 方法引用（用于绕过缓存）
 */
let originalRender: typeof mermaid.render | null = null;

/**
 * 生成缓存键（包含主题信息）
 */
function getCacheKey(code: string, theme: MermaidTheme): string {
  return `${theme}:::${code}`;
}

/**
 * 获取 Mermaid 全局实例
 *
 * 如果实例未初始化或主题发生变化，则重新初始化。
 * 确保全局只有一个 Mermaid 实例，避免重复初始化开销。
 *
 * 阶段二优化：拦截 render 方法，添加缓存层。
 *
 * @param theme - Mermaid 主题（默认 'default'）
 * @returns Mermaid 实例
 */
export function getMermaidInstance(theme: MermaidTheme = 'default'): typeof mermaid {
  // 检查是否需要初始化
  const needsInit = !state || !state.initialized || state.theme !== theme;

  if (needsInit) {
    // 主题切换时清空缓存（SVG 样式依赖主题）
    if (state && state.theme !== theme) {
      clearMermaidCache();
    }

    // 使用全局 mermaid 对象（不需要 new）
    const instance = mermaid;

    // 保存原始 render 方法（只保存一次）
    if (!originalRender) {
      originalRender = instance.render.bind(instance);
    }

    // 初始化 Mermaid 配置
    instance.initialize({
      theme: theme,
      startOnLoad: false,
      securityLevel: 'strict',
      fontFamily: 'monospace',
      logLevel: 'fatal',         // 进一步减少日志：仅在严重错误时输出
      suppressErrorRendering: true, // 抑制错误渲染（流式时不完整图表的错误）

      // Flowchart 流程图（最常用）
      flowchart: {
        // 使用默认 dagre 渲染器（比 ELK 快 4-8 倍）- 阶段一优化
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
    });

    // 阶段二优化：拦截 render 方法，添加缓存层
    instance.render = async function (
      id: string,
      text: string,
      svgContainingElement?: Element
    ): Promise<{ svg: string; diagramType: string }> {
      const cacheKey = getCacheKey(text, theme);

      // 1. 尝试从缓存获取
      const cachedSvg = getCachedMermaid(cacheKey);
      if (cachedSvg) {
        if (import.meta.env.DEV) {
          console.log('[MermaidInstance] 缓存命中:', id);
        }
        // 缓存命中时，diagramType 可能为空，使用默认值
        return { svg: cachedSvg, diagramType: 'flowchart' };
      }

      // 2. 缓存未命中，调用原始 render
      if (import.meta.env.DEV) {
        console.log('[MermaidInstance] 缓存未命中，开始渲染:', id);
      }

      const result = await originalRender!(id, text, svgContainingElement);

      // 3. 存入缓存
      setCachedMermaid(cacheKey, result.svg);

      return result;
    };

    // 更新状态
    state = {
      instance,
      theme,
      initialized: true,
    };
  }

  return state!.instance;
}

/**
 * 获取当前实例的主题
 *
 * @returns 当前主题，如果未初始化则返回 null
 */
export function getCurrentTheme(): MermaidTheme | null {
  return state?.theme ?? null;
}

/**
 * 重置 Mermaid 实例
 *
 * 强制清除当前实例，下次调用 getMermaidInstance 时会重新初始化。
 * 主要用于主题切换或内存清理场景。
 */
export function resetMermaidInstance(): void {
  state = null;
}
