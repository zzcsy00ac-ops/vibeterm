/**
 * SkillDialog - Skill 创建/编辑对话框
 *
 * 支持创建新 Skill 和编辑现有 Skill
 * 使用 @radix-ui/themes 的 Dialog 组件，自动获得主题样式
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, Flex, Text, Button, TextField, TextArea } from '@radix-ui/themes';
import { X, Sparkles, FileText, Tags, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Skill, CreateSkillInput, UpdateSkillInput } from '../../types/skill';
import { getLocalizedName, getLocalizedDescription, getActiveKeywords } from '../../utils/skillUtils';
import './SkillDialog.css';

export interface SkillDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 编辑模式：现有的 Skill 数据 */
  editSkill?: Skill | null;
  /** 保存回调（创建或更新） */
  onSave: (data: CreateSkillInput | UpdateSkillInput) => Promise<void>;
}

interface FormData {
  name: string;
  description: string;
  triggerKeywords: string;
  instructions: string;
}

export function SkillDialog({
  open,
  onOpenChange,
  editSkill,
  onSave,
}: SkillDialogProps) {
  const { t, i18n } = useTranslation();
  const isEditMode = !!editSkill;
  const isPresetSkill = editSkill?.isPreset ?? false;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    triggerKeywords: '',
    instructions: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  // 获取本地化后的显示内容
  const localizedEditData = useMemo(() => {
    if (!editSkill) return null;
    return {
      name: getLocalizedName(editSkill, t),
      description: getLocalizedDescription(editSkill, t),
      triggerKeywords: getActiveKeywords(editSkill, i18n.language),
    };
  }, [editSkill, t, i18n.language]);

  // 自动调整 instructions textarea 高度
  const adjustTextareaHeight = useCallback(() => {
    const textarea = instructionsRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  // 当 instructions 内容变化时调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.instructions, adjustTextareaHeight]);

  // 初始化或重置表单
  useEffect(() => {
    if (open) {
      if (editSkill && localizedEditData) {
        setFormData({
          name: localizedEditData.name,
          description: localizedEditData.description,
          triggerKeywords: localizedEditData.triggerKeywords.join(', '),
          instructions: editSkill.instructions,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          triggerKeywords: '',
          instructions: '',
        });
      }
      setErrors({});
    }
  }, [open, editSkill, localizedEditData]);

  // 更新字段
  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('skill.validation.nameRequired', '名称不能为空');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('skill.validation.descriptionRequired', '描述不能为空');
    }

    if (!formData.instructions.trim()) {
      newErrors.instructions = t('skill.validation.instructionsRequired', '指令内容不能为空');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const keywords = formData.triggerKeywords
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      // 对于预置 Skills，只更新 instructions 和 enabled
      // name 和 description 保持 i18n key 不变
      if (isPresetSkill && editSkill) {
        const data: UpdateSkillInput = {
          instructions: formData.instructions.trim(),
        };
        await onSave(data);
      } else {
        // 用户自定义 Skills 完全更新
        const data: CreateSkillInput = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          triggerKeywords: keywords,
          instructions: formData.instructions.trim(),
        };
        await onSave(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('[SkillDialog] Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSaving) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px" className="skill-dialog-content">
        {/* 头部 */}
        <Flex justify="between" align="center" className="dialog-header">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <Sparkles size={18} style={{ color: 'var(--accent-9)' }} />
              {isEditMode
                ? t('skill.editTitle', '编辑 Skill')
                : t('skill.createTitle', '创建 Skill')}
            </Flex>
          </Dialog.Title>
          <Dialog.Close>
            <button className="dialog-close-btn">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Flex>

        {/* 主体内容 */}
        <Flex direction="column" gap="4" className="dialog-body" onKeyDown={handleKeyDown}>
          {/* 名称 */}
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              <Flex align="center" gap="1">
                <Sparkles size={12} />
                {t('skill.name', '名称')} <Text color="red">*</Text>
              </Flex>
            </Text>
            <TextField.Root
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('skill.namePlaceholder', '例如：SSH 运维专家')}
              disabled={isSaving}
              autoFocus
              color={errors.name ? 'red' : undefined}
            />
            {errors.name && (
              <Text size="1" color="red">{errors.name}</Text>
            )}
          </Flex>

          {/* 描述 */}
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              <Flex align="center" gap="1">
                <FileText size={12} />
                {t('skill.description', '描述')} <Text color="red">*</Text>
              </Flex>
            </Text>
            <TextArea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t(
                'skill.descriptionPlaceholder',
                '描述这个 Skill 的功能以及何时应该使用它'
              )}
              rows={2}
              disabled={isSaving}
              color={errors.description ? 'red' : undefined}
            />
            {errors.description && (
              <Text size="1" color="red">{errors.description}</Text>
            )}
            <Text size="1" color="gray">
              {t(
                'skill.descriptionHint',
                'AI 会根据描述判断何时激活此 Skill'
              )}
            </Text>
          </Flex>

          {/* 触发关键词 */}
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              <Flex align="center" gap="1">
                <Tags size={12} />
                {t('skill.triggerKeywords', '触发关键词')}
              </Flex>
            </Text>
            <TextField.Root
              value={formData.triggerKeywords}
              onChange={(e) => updateField('triggerKeywords', e.target.value)}
              placeholder={t(
                'skill.triggerKeywordsPlaceholder',
                'SSH, 远程, 服务器（逗号分隔）'
              )}
              disabled={isSaving}
            />
            <Text size="1" color="gray">
              {t(
                'skill.triggerKeywordsHint',
                '用户输入包含这些关键词时，AI 可能会激活此 Skill'
              )}
            </Text>
          </Flex>

          {/* 指令内容 */}
          <Flex direction="column" gap="1" className="form-field-grow">
            <Text as="label" size="2" weight="medium">
              <Flex align="center" gap="1">
                <MessageSquare size={12} />
                {t('skill.instructions', '指令内容')}{' '}
                <Text color="red">*</Text>
              </Flex>
            </Text>
            <TextArea
              ref={instructionsRef}
              value={formData.instructions}
              onChange={(e) => updateField('instructions', e.target.value)}
              placeholder={t(
                'skill.instructionsPlaceholder',
                '使用 Markdown 格式编写详细的指令内容...'
              )}
              disabled={isSaving}
              className="form-textarea-grow"
              color={errors.instructions ? 'red' : undefined}
              style={{ overflow: 'hidden', resize: 'none' }}
            />
            {errors.instructions && (
              <Text size="1" color="red">{errors.instructions}</Text>
            )}
            <Text size="1" color="gray">
              {t(
                'skill.instructionsHint',
                '支持 Markdown 格式，建议包含"何时使用"和"操作指南"等章节'
              )}
            </Text>
          </Flex>
        </Flex>

        {/* 底部按钮 */}
        <Flex gap="3" justify="end" className="dialog-footer">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isSaving}>
              {t('common.cancel', '取消')}
            </Button>
          </Dialog.Close>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving
              ? t('common.saving', '保存中...')
              : t('common.save', '保存')}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
