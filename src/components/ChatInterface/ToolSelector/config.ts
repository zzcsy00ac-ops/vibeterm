/**
 * ToolSelector 工具配置
 *
 * 定义工具分组和每个工具的元数据（名称、描述、图标等）
 */

import type { MultiSelectItem, MultiSelectGroup } from '../../common/MultiSelect/types';
import type { ToolName } from '../../../services/tools';

/**
 * 工具分组定义
 */
export const TOOL_GROUPS: MultiSelectGroup[] = [
  {
    id: 'ssh',
    label: 'tool.group.ssh',
    description: 'tool.group.ssh.description',
  },
  {
    id: 'utility',
    label: 'tool.group.utility',
    description: 'tool.group.utility.description',
  },
  {
    id: 'system',
    label: 'tool.group.system',
    description: 'tool.group.system.description',
  },
];

/**
 * 工具配置映射
 */
export const TOOL_ITEMS_CONFIG: Record<ToolName, Omit<MultiSelectItem, 'value'>> = {
  listSSHServers: {
    label: 'tool.listSSHServers.name',
    description: 'tool.listSSHServers.description',
    group: 'ssh',
  },
  executeCommand: {
    label: 'tool.executeCommand.name',
    description: 'tool.executeCommand.description',
    group: 'ssh',
  },
  calculateExpression: {
    label: 'tool.calculateExpression.name',
    description: 'tool.calculateExpression.description',
    group: 'utility',
  },
  getCurrentTime: {
    label: 'tool.getCurrentTime.name',
    description: 'tool.getCurrentTime.description',
    group: 'system',
  },
};

/**
 * 生成工具配置列表
 */
export function getToolItems(tools: ToolName[]): MultiSelectItem[] {
  return tools.map(tool => ({
    value: tool,
    ...TOOL_ITEMS_CONFIG[tool],
  }));
}
