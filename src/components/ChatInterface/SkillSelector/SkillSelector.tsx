/**
 * SkillSelector - Skill 快速选择器
 *
 * 在聊天输入框旁边提供快速选择和激活 Skill 的功能
 */

import { useState, useCallback, useMemo } from 'react';
import { Popover, Flex, Text, Checkbox, Badge, Box } from '@radix-ui/themes';
import { BookOpen, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSkillStore } from '../../../store/skillStore';
import { getLocalizedName, getLocalizedDescription } from '../../../utils/skillUtils';
import { SETTINGS_WINDOW_CONFIG } from '../../../config/window';
import './SkillSelector.css';

interface SkillSelectorProps {
  /** 可选的外部控制激活的 Skills */
  activeSkillIds?: string[];
  /** 激活变化回调 */
  onActiveSkillsChange?: (ids: string[]) => void;
}

export function SkillSelector({
  activeSkillIds: externalActiveIds,
  onActiveSkillsChange,
}: SkillSelectorProps) {
  const { t } = useTranslation();

  // Store 状态
  const {
    getAllSkills,
    activeSkillIds: storeActiveIds,
    setActiveSkills,
  } = useSkillStore();

  // 使用外部控制或 Store 控制
  const isControlled = externalActiveIds !== undefined;
  const activeIds = isControlled ? externalActiveIds : storeActiveIds;
  const setActive = isControlled
    ? (ids: string[]) => onActiveSkillsChange?.(ids)
    : setActiveSkills;

  // 本地状态
  const [open, setOpen] = useState(false);

  // 获取所有 Skills
  const allSkills = useMemo(() => getAllSkills(), [getAllSkills]);

  // 激活的 Skills 数量
  const activeCount = activeIds.length;

  // 切换 Skill 激活状态
  const toggleSkill = useCallback(
    (skillId: string) => {
      const newIds = activeIds.includes(skillId)
        ? activeIds.filter((id) => id !== skillId)
        : [...activeIds, skillId];
      setActive(newIds);
    },
    [activeIds, setActive]
  );

  // 打开 Skills 设置窗口
  const goToSettings = useCallback(async () => {
    setOpen(false);

    // 检查是否已存在设置窗口
    const existingWindow = await WebviewWindow.getByLabel('settings');

    if (existingWindow) {
      // 如果窗口已存在，显示并聚焦，然后导航到 Skills 页面
      await existingWindow.show();
      await existingWindow.setFocus();
      // 通过 URL hash 或其他方式导航到 skills tab
      // 由于设置窗口是同一个应用实例，可以通过 store 或其他方式同步
      return;
    }

    // 创建新的设置窗口，直接导航到 Skills 页面
    const mainWindow = getCurrentWindow();
    const mainPosition = await mainWindow.outerPosition();
    const mainSize = await mainWindow.outerSize();

    const settingsX = mainPosition.x + (mainSize.width - SETTINGS_WINDOW_CONFIG.width) / 2;
    const settingsY = mainPosition.y + (mainSize.height - SETTINGS_WINDOW_CONFIG.height) / 2;

    new WebviewWindow('settings', {
      url: '/settings/skills',
      title: t('app.settings'),
      width: SETTINGS_WINDOW_CONFIG.width,
      height: SETTINGS_WINDOW_CONFIG.height,
      x: settingsX,
      y: settingsY,
      resizable: SETTINGS_WINDOW_CONFIG.resizable,
      decorations: SETTINGS_WINDOW_CONFIG.decorations,
      visible: false,
    });
  }, [t]);

  // 生成按钮文本
  const buttonText = useMemo(() => {
    if (activeCount === 0) {
      return t('skillSelector.none', 'Skills');
    }
    return t('skillSelector.count', '{{count}} Skill', { count: activeCount });
  }, [activeCount, t]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button className="skill-selector-trigger">
          <BookOpen size={14} />
          <span className="skill-selector-text">{buttonText}</span>
          {activeCount > 0 && (
            <Badge size="1" color="green" variant="soft" className="skill-selector-badge">
              {activeCount}
            </Badge>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Content width="320px" side="top" align="start" sideOffset={8}>
        <Flex direction="column" gap="2">
          {/* 标题 */}
          <Flex justify="between" align="center" className="skill-selector-header">
            <Text size="2" weight="medium">
              {t('skillSelector.title', '专业技能')}
            </Text>
            <button
              className="skill-selector-settings"
              onClick={goToSettings}
              title={t('skillSelector.settings', '管理')}
            >
              <Settings size={14} />
            </button>
          </Flex>

          {/* Skill 列表 */}
          <Box className="skill-selector-list">
            {allSkills.length === 0 ? (
              <Text size="2" color="gray" className="skill-selector-empty">
                {t('skillSelector.empty', '暂无可用 Skill')}
              </Text>
            ) : (
              allSkills.map((skill) => {
                const isActive = activeIds.includes(skill.id);
                const localizedName = getLocalizedName(skill, t);
                const localizedDescription = getLocalizedDescription(skill, t);
                return (
                  <label
                    key={skill.id}
                    className={`skill-selector-item ${isActive ? 'active' : ''}`}
                  >
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={() => toggleSkill(skill.id)}
                    />
                    <Flex direction="column" gap="1" className="skill-selector-item-content">
                      <Text size="2" weight="medium">
                        {localizedName}
                      </Text>
                      <Text size="1" color="gray" className="skill-selector-item-desc">
                        {localizedDescription.slice(0, 60)}
                        {localizedDescription.length > 60 ? '...' : ''}
                      </Text>
                    </Flex>
                  </label>
                );
              })
            )}
          </Box>

          {/* 提示 */}
          <Text size="1" color="gray" className="skill-selector-hint">
            {t(
              'skillSelector.hint',
              '激活的 Skills 将为 AI 提供专业指导'
            )}
          </Text>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}
