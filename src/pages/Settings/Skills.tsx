/**
 * Skills 设置页面
 *
 * 管理和配置 AI Agent 的专业技能
 */

import { useState, useCallback } from 'react';
import { Flex, Text, Button, IconButton } from '@radix-ui/themes';
import { Plus, Upload, Download, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../../store/skillStore';
import { SkillCard } from '../../components/SkillCard';
import { SkillDialog } from '../../components/SkillDialog';
import type { Skill, CreateSkillInput, UpdateSkillInput } from '../../types/skill';
import './Skills.css';

export default function Skills() {
  const { t } = useTranslation();

  // Store 状态和方法
  const {
    getAllSkills,
    getActiveSkills,
    addSkill,
    updateSkill,
    deleteSkill,
    toggleSkill,
    exportSkills,
    importSkills,
    resetToPresets,
    activeSkillIds,
  } = useSkillStore();

  // 本地状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // 获取数据
  const allSkills = getAllSkills();
  const activeSkills = getActiveSkills();

  // 打开创建对话框
  const handleCreate = useCallback(() => {
    setEditingSkill(null);
    setDialogOpen(true);
  }, []);

  // 打开编辑对话框
  const handleEdit = useCallback((skill: Skill) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  }, []);

  // 保存 Skill（创建或更新）
  const handleSave = useCallback(
    async (data: CreateSkillInput | UpdateSkillInput) => {
      if (editingSkill) {
        // 更新模式
        updateSkill(editingSkill.id, data);
      } else {
        // 创建模式
        addSkill(data as CreateSkillInput);
      }
    },
    [editingSkill, addSkill, updateSkill]
  );

  // 删除 Skill
  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm(t('skill.deleteConfirm', '确定要删除这个 Skill 吗？'))) {
        const success = deleteSkill(id);
        if (!success) {
          alert(t('skill.cannotDeletePreset', '预置 Skill 不能删除'));
        }
      }
    },
    [deleteSkill, t]
  );

  // 导出单个 Skill
  const handleExportOne = useCallback(
    (id: string) => {
      const jsonStr = exportSkills([id]);
      const skill = allSkills.find((s) => s.id === id);
      if (skill) {
        downloadFile(jsonStr, `skill-${skill.name.replace(/\s+/g, '-')}.json`);
      }
    },
    [exportSkills, allSkills]
  );

  // 导出所有 Skills
  const handleExportAll = useCallback(() => {
    const jsonStr = exportSkills();
    downloadFile(jsonStr, `skills-${new Date().toISOString().split('T')[0]}.json`);
  }, [exportSkills]);

  // 导入 Skills
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = importSkills(text, 'merge');

        if (result.errors.length > 0) {
          alert(t('skill.importError', '导入失败：{{errors}}', { errors: result.errors.join(', ') }));
        } else {
          alert(
            t('skill.importSuccess', '导入成功：成功 {{success}} 个，跳过 {{skipped}} 个', {
              success: result.success,
              skipped: result.skipped,
            })
          );
        }
      } catch (error) {
        alert(t('skill.importFailed', '导入失败：{{error}}', { error: String(error) }));
      }
    };
    input.click();
  }, [importSkills, t]);

  // 重置为预置 Skills
  const handleReset = useCallback(() => {
    if (window.confirm(t('skill.resetConfirm', '确定要重置为预置 Skills 吗？这将删除所有自定义 Skills。'))) {
      resetToPresets();
    }
  }, [resetToPresets, t]);

  return (
    <div className="skills-page">
      {/* 头部 */}
      <Flex justify="between" align="center" className="skills-header">
        <Flex direction="column" gap="1">
          <Text size="5" weight="medium">
            {t('skills.title', '专业技能')}
          </Text>
          <Text size="2" color="gray">
            {t('skills.subtitle', '管理和配置 AI Agent 的专业技能')}
          </Text>
        </Flex>
        <Flex gap="2">
          <IconButton
            size="2"
            variant="outline"
            color="gray"
            onClick={handleReset}
            title={t('skills.reset', '重置为预置')}
          >
            <RotateCcw size={14} />
          </IconButton>
          <IconButton
            size="2"
            variant="outline"
            color="gray"
            onClick={handleImport}
            title={t('skills.import', '导入')}
          >
            <Upload size={14} />
          </IconButton>
          <IconButton
            size="2"
            variant="outline"
            color="gray"
            onClick={handleExportAll}
            title={t('skills.exportAll', '导出全部')}
          >
            <Download size={14} />
          </IconButton>
          <Button size="2" onClick={handleCreate}>
            <Plus size={14} />
            {t('skills.create', '创建')}
          </Button>
        </Flex>
      </Flex>

      {/* 统计信息 */}
      <Flex gap="4" className="skills-stats">
        <Text size="2" color="gray">
          {t('skills.total', '共 {{count}} 个 Skill', { count: allSkills.length })}
        </Text>
        <Text size="2" color="gray">
          {t('skills.active', '已激活 {{count}} 个', { count: activeSkills.length })}
        </Text>
      </Flex>

      {/* Skill 列表 */}
      <div className="skills-list">
        {allSkills.length === 0 ? (
          <div className="skills-empty">
            <Text size="3" color="gray">
              {t('skills.empty', '暂无 Skill，点击"创建"添加第一个')}
            </Text>
          </div>
        ) : (
          allSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isActive={activeSkillIds.includes(skill.id)}
              onToggle={toggleSkill}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExport={handleExportOne}
            />
          ))
        )}
      </div>

      {/* 创建/编辑对话框 */}
      <SkillDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSkill={editingSkill}
        onSave={handleSave}
      />
    </div>
  );
}

/**
 * 下载文件辅助函数
 */
function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
