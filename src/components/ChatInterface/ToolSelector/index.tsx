/**
 * ToolSelector - AI 工具选择器业务组件
 *
 * 功能：
 * - 基于通用 MultiSelect 组件实现工具选择
 * - 处理工具配置和分组
 * - 处理国际化翻译
 * - 与 chatStore 集成
 */

import { useTranslation } from 'react-i18next';
import { MultiSelect } from '../../common/MultiSelect';
import { TOOL_GROUPS, getToolItems } from './config';
import { toolRegistry, type ToolName } from '../../../services/tools';

interface ToolSelectorProps {
  selectedTools: ToolName[];
  onToolsChange: (tools: ToolName[]) => void;
  disabled?: boolean;
}

export function ToolSelector({ selectedTools, onToolsChange, disabled }: ToolSelectorProps) {
  const { t } = useTranslation();

  // 生成工具配置列表（翻译标签）
  const items = getToolItems(Object.keys(toolRegistry) as ToolName[]).map(item => ({
    ...item,
    label: t(item.label as any) as string,
    description: t(item.description as any) as string,
  }));

  // 翻译分组标签
  const groups = TOOL_GROUPS.map(group => ({
    ...group,
    label: t(group.label as any) as string,
    description: group.description ? t(group.description as any) as string : undefined,
  }));

  return (
    <MultiSelect
      items={items}
      groups={groups}
      value={selectedTools}
      onChange={(value) => onToolsChange(value as ToolName[])}
      placeholder={t('chat.tools.label' as any)}
      searchPlaceholder={t('chat.tools.searchPlaceholder' as any)}
      selectAllLabel={t('chat.tools.selectAll' as any)}
      title={t('chat.tools.title' as any)}
      noResultsText={t('chat.tools.noResults' as any)}
      selectedCountText={(current, total) =>
        t('chat.tools.selectedCount' as any, { current, total })
      }
      disabled={disabled}
    />
  );
}
