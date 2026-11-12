/**
 * SkillCard - Skill 卡片组件
 *
 * 展示单个 Skill 的信息和操作按钮
 */

import { memo, useMemo } from 'react';
import { Flex, Text, Switch, IconButton, Badge } from '@radix-ui/themes';
import { Pencil, Trash2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Skill } from '../../types/skill';
import { getLocalizedName, getLocalizedDescription, getActiveKeywords } from '../../utils/skillUtils';
import './SkillCard.css';

interface SkillCardProps {
  /** Skill 数据 */
  skill: Skill;
  /** 是否激活 */
  isActive: boolean;
  /** 激活状态变化回调 */
  onToggle: (id: string) => void;
  /** 编辑回调 */
  onEdit: (skill: Skill) => void;
  /** 删除回调 */
  onDelete: (id: string) => void;
  /** 导出回调 */
  onExport: (id: string) => void;
}

export const SkillCard = memo(function SkillCard({
  skill,
  isActive,
  onToggle,
  onEdit,
  onDelete,
  onExport,
}: SkillCardProps) {
  const { t, i18n } = useTranslation();

  // 获取本地化内容
  const localizedName = useMemo(() => getLocalizedName(skill, t), [skill, t]);
  const localizedDescription = useMemo(() => getLocalizedDescription(skill, t), [skill, t]);
  const activeKeywords = useMemo(
    () => getActiveKeywords(skill, i18n.language),
    [skill, i18n.language]
  );

  return (
    <div className="skill-card">
      <Flex direction="column" gap="2" className="skill-card-content">
        {/* 头部：名称 + 激活开关 + 预置标签 */}
        <Flex justify="between" align="center" gap="2">
          <Flex align="center" gap="2" className="skill-card-header">
            <Text size="3" weight="medium" className="skill-card-name">
              {localizedName}
            </Text>
            {skill.isPreset && (
              <Badge size="1" color="gray" variant="soft">
                {t('skill.preset', '预置')}
              </Badge>
            )}
          </Flex>
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggle(skill.id)}
            aria-label={t('skill.toggleActive', '切换激活状态')}
          />
        </Flex>

        {/* 描述 */}
        <Text size="2" color="gray" className="skill-card-description">
          {localizedDescription}
        </Text>

        {/* 触发词 */}
        <Flex wrap="wrap" gap="1" className="skill-card-keywords">
          {activeKeywords.slice(0, 5).map((keyword, index) => (
            <Badge key={index} size="1" variant="outline" color="gray">
              {keyword}
            </Badge>
          ))}
          {activeKeywords.length > 5 && (
            <Badge size="1" variant="outline" color="gray">
              +{activeKeywords.length - 5}
            </Badge>
          )}
        </Flex>

        {/* 操作按钮 */}
        <Flex justify="end" gap="2" className="skill-card-actions">
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => onExport(skill.id)}
            aria-label={t('skill.export', '导出')}
            title={t('skill.export', '导出')}
          >
            <Download size={14} />
          </IconButton>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => onEdit(skill)}
            aria-label={t('skill.edit', '编辑')}
            title={t('skill.edit', '编辑')}
          >
            <Pencil size={14} />
          </IconButton>
          {!skill.isPreset && (
            <IconButton
              size="1"
              variant="ghost"
              color="red"
              onClick={() => onDelete(skill.id)}
              aria-label={t('skill.delete', '删除')}
              title={t('skill.delete', '删除')}
            >
              <Trash2 size={14} />
            </IconButton>
          )}
        </Flex>
      </Flex>
    </div>
  );
});
