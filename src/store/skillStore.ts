/**
 * Skill 技能管理 Store
 *
 * 使用 Zustand + TauriStoreState 实现持久化和多窗口同步
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TauriStoreState } from './tauriStoreState';
import { storeSave } from '../command';
import type {
  Skill,
  CreateSkillInput,
  UpdateSkillInput,
} from '../types/skill';

// ==================== 预置 Skills ====================

/**
 * 预置 Skills 数据
 *
 * 国际化说明：
 * - name 和 description 使用 i18n key（如 'presetSkills.sshOperations.name'）
 * - triggerKeywords 按语言存储 { en: [...], cn: [...], de: [...] }
 * - instructions 保持英文，确保 AI 执行一致性
 */
const PRESET_SKILLS: Skill[] = [
  {
    id: 'ssh-operations',
    name: 'presetSkills.sshOperations.name',
    description: 'presetSkills.sshOperations.description',
    triggerKeywords: {
      en: ['SSH', 'remote', 'server', 'deploy', 'command'],
      cn: ['SSH', '远程', '服务器', '运维', '部署', '命令'],
      de: ['SSH', 'Server', 'Bereitstellung', 'Befehl', 'Fernzugriff']
    },
    instructions: `## When to Use

Use this skill when users need to:
- Execute commands on remote servers
- Check server resource status (CPU, memory, disk)
- Deploy applications or services
- Manage remote files

## Operation Guide

### Pre-execution Checks
1. Use listSSHServers tool to confirm target server ID
2. Assess command risk level (read/write/dangerous operations)
3. High-risk commands (rm, shutdown, etc.) require user confirmation

### Common Operations Commands
- Disk space: df -h
- Memory status: free -h
- CPU info: lscpu or cat /proc/cpuinfo
- Process list: ps aux | grep <name>
- System load: uptime
- Network connections: netstat -tlnp or ss -tlnp

### Security Principles
- Never execute rm -rf without confirmation
- Backup configuration files before modifying
- Clearly inform users of the impact of sensitive operations`,
    enabled: true,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'log-analysis',
    name: 'presetSkills.logAnalysis.name',
    description: 'presetSkills.logAnalysis.description',
    triggerKeywords: {
      en: ['log', 'analysis', 'error', 'debug', 'troubleshoot'],
      cn: ['日志', 'log', '分析', '错误', '排查', 'debug'],
      de: ['Log', 'Analyse', 'Fehler', 'Debug', 'Fehlerbehebung']
    },
    instructions: `## When to Use

Use this skill when users need to:
- View and analyze system logs
- Identify error patterns and anomalies
- Troubleshoot root causes
- Generate log analysis reports

## Common Log Locations

### Linux System Logs
- /var/log/syslog - Main system log
- /var/log/auth.log - Authentication log
- /var/log/nginx/access.log - Nginx access log
- /var/log/nginx/error.log - Nginx error log
- /var/log/docker.log - Docker log

## Analysis Techniques

### Finding Errors
\`\`\`bash
grep -i "error|fatal|critical" /var/log/syslog
grep -i "exception" /var/log/app/*.log
\`\`\`

### Counting Error Frequency
\`\`\`bash
grep -i "error" /var/log/app.log | awk '{print $4}' | sort | uniq -c | sort -rn
\`\`\`

### Real-time Monitoring
\`\`\`bash
tail -f /var/log/app.log | grep --line-buffered "error"
\`\`\`

## Report Format

After analysis, output in the following format:
1. Issue summary
2. Key error list
3. Timeline analysis
4. Recommended solutions`,
    enabled: true,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'docker-management',
    name: 'presetSkills.dockerManagement.name',
    description: 'presetSkills.dockerManagement.description',
    triggerKeywords: {
      en: ['Docker', 'container', 'image', 'docker-compose'],
      cn: ['Docker', '容器', 'container', '镜像', 'image', 'docker-compose'],
      de: ['Docker', 'Container', 'Image', 'docker-compose']
    },
    instructions: `## When to Use

Use this skill when users need to:
- Manage container lifecycle (start, stop, restart)
- View container status and logs
- Manage images (pull, delete, build)
- Configure Docker networks
- Use docker-compose to orchestrate services

## Common Commands

### Container Management
\`\`\`bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# View container logs
docker logs <container> -f --tail 100

# Enter container
docker exec -it <container> /bin/bash

# Stop/start/restart
docker stop/start/restart <container>
\`\`\`

### Image Management
\`\`\`bash
# List images
docker images

# Pull image
docker pull <image>:<tag>

# Delete image
docker rmi <image>

# Clean unused images
docker image prune
\`\`\`

### Resource Cleanup
\`\`\`bash
# Clean all unused resources
docker system prune -a

# View disk usage
docker system df
\`\`\`

## Notes
- Confirm no important data before deleting containers
- Use prune commands carefully in production
- Large image pulls may take a while`,
    enabled: false,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'system-monitoring',
    name: 'presetSkills.systemMonitoring.name',
    description: 'presetSkills.systemMonitoring.description',
    triggerKeywords: {
      en: ['monitor', 'CPU', 'memory', 'disk', 'performance', 'resource'],
      cn: ['监控', 'CPU', '内存', '磁盘', '性能', 'performance', '资源'],
      de: ['Überwachung', 'CPU', 'Speicher', 'Festplatte', 'Leistung', 'Ressource']
    },
    instructions: `## When to Use

Use this skill when users need to:
- View system resource usage
- Analyze performance bottlenecks
- Monitor process status
- Set up resource alerts

## Monitoring Commands

### CPU Monitoring
\`\`\`bash
# CPU usage
top -bn1 | head -20

# CPU core info
lscpu

# Real-time monitoring
htop  # if installed
\`\`\`

### Memory Monitoring
\`\`\`bash
# Memory usage
free -h

# Detailed memory info
cat /proc/meminfo

# Top 10 memory-consuming processes
ps aux --sort=-%mem | head -11
\`\`\`

### Disk Monitoring
\`\`\`bash
# Disk usage
df -h

# Directory size
du -sh /path/to/dir

# Disk I/O
iostat -x 1
\`\`\`

### Network Monitoring
\`\`\`bash
# Network connections
ss -tulpn

# Network traffic
iftop  # if installed
\`\`\`

## Performance Analysis Flow
1. Check overall resource usage (top, free, df)
2. Find high resource-consuming processes
3. Analyze process details
4. Provide optimization recommendations`,
    enabled: false,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'deployment',
    name: 'presetSkills.deployment.name',
    description: 'presetSkills.deployment.description',
    triggerKeywords: {
      en: ['deploy', 'release', 'CI/CD', 'pipeline'],
      cn: ['部署', 'deploy', '发布', '上线', 'CI/CD', 'pipeline', '发布流程'],
      de: ['Bereitstellung', 'Release', 'CI/CD', 'Pipeline']
    },
    instructions: `## When to Use

Use this skill when users need to:
- Deploy applications to servers
- Execute release processes
- Rollback to previous versions
- Configure CI/CD pipelines

## Pre-deployment Checklist

### 1. Code Preparation
- [ ] Confirm code committed to correct branch
- [ ] Confirm tests passed
- [ ] Confirm version number updated

### 2. Server Preparation
- [ ] Confirm sufficient disk space
- [ ] Confirm dependency services (databases, etc.) are normal
- [ ] Confirm backups completed

### 3. Deployment Execution
- [ ] Pull latest code
- [ ] Install dependencies
- [ ] Execute database migrations (if any)
- [ ] Restart services
- [ ] Verify services normal

## Common Deployment Commands

### Git Deployment
\`\`\`bash
git pull origin main
npm install --production
npm run build
pm2 restart app
\`\`\`

### Docker Deployment
\`\`\`bash
docker-compose pull
docker-compose up -d
docker-compose logs -f
\`\`\`

## Rollback Process
1. Stop current service
2. Switch to previous version code/image
3. Restart service
4. Verify service normal`,
    enabled: false,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'security-audit',
    name: 'presetSkills.securityAudit.name',
    description: 'presetSkills.securityAudit.description',
    triggerKeywords: {
      en: ['security', 'audit', 'vulnerability', 'CVE', 'penetration'],
      cn: ['安全', '审计', '漏洞', '安全检查', 'security', '渗透', 'CVE'],
      de: ['Sicherheit', 'Audit', 'Schwachstelle', 'CVE', 'Penetration']
    },
    instructions: `## When to Use

Use this skill when users need to:
- Conduct security audits
- Check system vulnerabilities
- Review user permissions
- Check security configurations

## Security Checklist

### 1. Users and Permissions
\`\`\`bash
# View logged in users
who

# View sudo users
grep -Po '^sudo.+:\\K.*$' /etc/group

# View recent logins
last -n 20
\`\`\`

### 2. Open Ports
\`\`\`bash
# View listening ports
ss -tlnp

# View firewall status
ufw status
\`\`\`

### 3. System Updates
\`\`\`bash
# Check available security updates
apt list --upgradable 2>/dev/null | grep -i security
\`\`\`

### 4. Log Audit
\`\`\`bash
# Check failed login attempts
grep "Failed password" /var/log/auth.log | tail -20

# Check sudo usage records
grep "sudo:" /var/log/auth.log | tail -20
\`\`\`

## Security Recommendations
- Regularly update system and software
- Disable unnecessary services and ports
- Use key authentication instead of passwords
- Configure firewall rules
- Regularly review user permissions`,
    enabled: false,
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ==================== Store 类型 ====================

interface SkillStore {
  // ========== 状态 ==========
  /** 所有 Skills（使用对象实现 O(1) 查找） */
  skills: Record<string, Skill>;
  /** 当前激活的 Skill ID 列表 */
  activeSkillIds: string[];
  /** Store 是否已完成初始化 */
  _hydrated: boolean;

  // ========== Skill CRUD ==========
  /** 添加 Skill */
  addSkill: (skill: CreateSkillInput) => string;
  /** 更新 Skill */
  updateSkill: (id: string, updates: UpdateSkillInput) => void;
  /** 删除 Skill（预置 Skill 不可删除） */
  deleteSkill: (id: string) => boolean;
  /** 获取单个 Skill */
  getSkill: (id: string) => Skill | undefined;
  /** 获取所有 Skills */
  getAllSkills: () => Skill[];

  // ========== 激活管理 ==========
  /** 激活 Skill */
  activateSkill: (id: string) => void;
  /** 停用 Skill */
  deactivateSkill: (id: string) => void;
  /** 切换 Skill 激活状态 */
  toggleSkill: (id: string) => void;
  /** 设置激活的 Skills */
  setActiveSkills: (ids: string[]) => void;
  /** 获取激活的 Skills */
  getActiveSkills: () => Skill[];

  // ========== 指令生成 ==========
  /** 获取激活 Skills 的描述（用于 AI 识别） */
  getSkillDescriptions: () => string;
  /** 获取激活 Skills 的完整指令 */
  getActiveInstructions: () => string;

  // ========== 导入导出 ==========
  /** 导出 Skills */
  exportSkills: (ids?: string[]) => string;
  /** 导入 Skills */
  importSkills: (jsonStr: string, mode: 'merge' | 'overwrite') => { success: number; skipped: number; errors: string[] };

  // ========== 重置 ==========
  /** 重置为预置 Skills */
  resetToPresets: () => void;
}

// ==================== 工具函数 ====================

/**
 * 生成默认 Skill 值
 */
function getDefaultSkillValues(): Omit<Skill, 'id' | 'name' | 'description' | 'triggerKeywords' | 'instructions'> {
  return {
    enabled: true,
    isPreset: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 初始化预置 Skills 到 skills 对象
 */
function initializePresetSkills(): Record<string, Skill> {
  const skills: Record<string, Skill> = {};
  for (const skill of PRESET_SKILLS) {
    skills[skill.id] = {
      ...skill,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  return skills;
}

// ==================== 创建存储实例 ====================

// 保存 rehydrate 方法的引用
let rehydrateFn: (() => void) | null = null;

const tauriStore = new TauriStoreState('skill-store.json', {
  onRehydrate: () => {
    rehydrateFn?.();
  },
  debounce: 100,
  saveFn: async (currentWindow, storeName) => {
    try {
      await storeSave(storeName, currentWindow.label);
    } catch (error) {
      console.error('[SkillStore] Failed to save store:', error);
    }
  },
});

// ==================== 初始化存储 ====================

await tauriStore.init();

// ==================== 创建 Store ====================

export const useSkillStore = create<SkillStore>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      skills: initializePresetSkills(),
      activeSkillIds: PRESET_SKILLS.filter(s => s.enabled).map(s => s.id),
      _hydrated: false,

      // ========== Skill CRUD ==========

      addSkill: (input) => {
        const id = crypto.randomUUID();
        const newSkill: Skill = {
          ...getDefaultSkillValues(),
          ...input,
          id,
          enabled: input.enabled ?? true,
          isPreset: input.isPreset ?? false,
        };

        set((state) => ({
          skills: {
            ...state.skills,
            [id]: newSkill,
          },
        }));

        return id;
      },

      updateSkill: (id, updates) => {
        set((state) => {
          const skill = state.skills[id];
          if (!skill) {
            console.warn('[SkillStore] Skill not found:', id);
            return state;
          }
          return {
            skills: {
              ...state.skills,
              [id]: {
                ...skill,
                ...updates,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteSkill: (id) => {
        const skill = get().skills[id];
        if (!skill) {
          return false;
        }
        if (skill.isPreset) {
          console.warn('[SkillStore] Cannot delete preset skill:', id);
          return false;
        }

        set((state) => {
          const { [id]: removed, ...remaining } = state.skills;
          const newActiveIds = state.activeSkillIds.filter((activeId) => activeId !== id);
          return {
            skills: remaining,
            activeSkillIds: newActiveIds,
          };
        });

        return true;
      },

      getSkill: (id) => {
        return get().skills[id];
      },

      getAllSkills: () => {
        return Object.values(get().skills);
      },

      // ========== 激活管理 ==========

      activateSkill: (id) => {
        set((state) => {
          if (state.activeSkillIds.includes(id)) {
            return state;
          }
          return {
            activeSkillIds: [...state.activeSkillIds, id],
          };
        });
      },

      deactivateSkill: (id) => {
        set((state) => ({
          activeSkillIds: state.activeSkillIds.filter((activeId) => activeId !== id),
        }));
      },

      toggleSkill: (id) => {
        const state = get();
        if (state.activeSkillIds.includes(id)) {
          get().deactivateSkill(id);
        } else {
          get().activateSkill(id);
        }
      },

      setActiveSkills: (ids) => {
        set({ activeSkillIds: ids });
      },

      getActiveSkills: () => {
        const state = get();
        return state.activeSkillIds
          .map((id) => state.skills[id])
          .filter((skill): skill is Skill => skill !== undefined);
      },

      // ========== 指令生成 ==========

      getSkillDescriptions: () => {
        const activeSkills = get().getActiveSkills();
        if (activeSkills.length === 0) {
          return '';
        }

        const descriptions = activeSkills
          .map((s) => `- ${s.name}: ${s.description}`)
          .join('\n');

        return `# 可用专业技能\n\n${descriptions}`;
      },

      getActiveInstructions: () => {
        const activeSkills = get().getActiveSkills();
        if (activeSkills.length === 0) {
          return '';
        }

        const instructions = activeSkills
          .map((s) => `## ${s.name}\n\n${s.instructions}`)
          .join('\n\n---\n\n');

        return `# 专业技能指令\n\n${instructions}`;
      },

      // ========== 导入导出 ==========

      exportSkills: (ids) => {
        const state = get();
        const skillsToExport = ids
          ? ids.map((id) => state.skills[id]).filter((s): s is Skill => s !== undefined)
          : Object.values(state.skills);

        const exportData = {
          version: '1.0' as const,
          exportedAt: new Date().toISOString(),
          skills: skillsToExport,
        };

        return JSON.stringify(exportData, null, 2);
      },

      importSkills: (jsonStr, mode) => {
        const result = { success: 0, skipped: 0, errors: [] as string[] };

        try {
          const data = JSON.parse(jsonStr);

          if (!data.skills || !Array.isArray(data.skills)) {
            result.errors.push('Invalid format: missing skills array');
            return result;
          }

          const state = get();

          for (const skill of data.skills) {
            // 验证必要字段
            if (!skill.name || !skill.description || !skill.instructions) {
              result.skipped++;
              continue;
            }

            // 检查是否已存在
            const existingSkill = Object.values(state.skills).find(
              (s) => s.name === skill.name
            );

            if (existingSkill) {
              if (mode === 'overwrite') {
                // 覆盖模式：更新现有 Skill
                get().updateSkill(existingSkill.id, {
                  description: skill.description,
                  triggerKeywords: skill.triggerKeywords || [],
                  instructions: skill.instructions,
                });
                result.success++;
              } else {
                // 合并模式：跳过已存在的
                result.skipped++;
              }
            } else {
              // 添加新 Skill
              get().addSkill({
                name: skill.name,
                description: skill.description,
                triggerKeywords: skill.triggerKeywords || [],
                instructions: skill.instructions,
                enabled: skill.enabled ?? true,
              });
              result.success++;
            }
          }
        } catch (error) {
          result.errors.push(`Parse error: ${String(error)}`);
        }

        return result;
      },

      // ========== 重置 ==========

      resetToPresets: () => {
        const newSkills = initializePresetSkills();
        const newActiveIds = PRESET_SKILLS.filter(s => s.enabled).map(s => s.id);

        set({
          skills: newSkills,
          activeSkillIds: newActiveIds,
        });
      },
    }),
    {
      name: 'skill-store',
      storage: createJSONStorage(() => tauriStore),
      version: 2, // 版本 2: 支持 i18n 的预设 Skills
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as { skills?: Record<string, Skill>; activeSkillIds?: string[] };

        // 如果是旧版本（version < 2），需要迁移预设 Skills
        if (version < 2 && state?.skills) {
          console.log('[SkillStore] Migrating skills from version', version, 'to version 2');

          // 更新预设 Skills 为新的 i18n key 格式
          const presetSkillIds = [
            'ssh-operations',
            'log-analysis',
            'docker-management',
            'system-monitoring',
            'deployment',
            'security-audit',
          ];

          for (const presetId of presetSkillIds) {
            const preset = PRESET_SKILLS.find((s) => s.id === presetId);
            if (preset && state.skills[presetId]) {
              // 用新的预设数据覆盖旧的
              state.skills[presetId] = {
                ...state.skills[presetId],
                name: preset.name,
                description: preset.description,
                triggerKeywords: preset.triggerKeywords,
                instructions: preset.instructions,
              };
            }
          }
        }

        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hydrated = true;
        }
      },
    }
  )
);

// 保存 rehydrate 方法供后续使用
rehydrateFn = (useSkillStore as any).persist?.rehydrate;

// ==================== 类型导出 ====================

export type { SkillStore };
