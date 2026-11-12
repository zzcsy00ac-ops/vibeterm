/**
 * ToolApprovalCard - 工具执行确认卡片
 *
 * 用于 HITL (Human-in-the-Loop) 场景，在消息流中内联渲染工具确认 UI
 */

import { Flex, Text, Button, Card, Badge, Box, RadioCards } from '@radix-ui/themes';
import { AlertTriangle, Terminal, CheckCircle2, XCircle, Server, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { ApprovalRememberType } from '../../types/permissions';
import './ToolApprovalCard.css';

interface ApprovalOptions {
  rememberType: ApprovalRememberType;
}

interface ToolApprovalCardProps {
  invocation: any; // UIToolInvocation with executeCommand tool
  serverName: string;
  serverHost: string;
  onApprove: (options?: ApprovalOptions) => void;
  onDeny: () => void;
}

export function ToolApprovalCard({
  invocation,
  serverName,
  serverHost,
  onApprove,
  onDeny,
}: ToolApprovalCardProps) {
  const { t } = useTranslation();

  // 记住类型状态（默认仅此次执行）
  const [rememberType, setRememberType] = useState<ApprovalRememberType>('none');

  // 输出折叠/展开状态（默认折叠）
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);

  // 切换输出展开/折叠状态
  const toggleOutput = () => setIsOutputExpanded(prev => !prev);

  // 计算输出摘要（行数统计）
  const getOutputSummary = (outputText: string) => {
    const lines = outputText.split('\n').length;
    const chars = outputText.length;
    return { lines, chars };
  };

  // 渲染输出区域（支持折叠/展开）
  const renderOutputBox = (outputText: string, type: 'stdout' | 'stderr') => {
    const summary = getOutputSummary(outputText);

    return (
      <Flex direction="column" gap="2">
        {/* 展开/折叠按钮 */}
        <Button
          variant="soft"
          size="1"
          onClick={toggleOutput}
          className="toggle-button"
        >
          <Flex direction="row" align="center" gap="1">
            {isOutputExpanded ? (
              <>
                <ChevronUp size={14} aria-hidden="true" />
                {t('chat.toolApproval.collapseOutput')}
              </>
            ) : (
              <>
                <ChevronDown size={14} aria-hidden="true" />
                {t('chat.toolApproval.expandOutput')}
              </>
            )}
          </Flex>
        </Button>

        {/* 输出内容 */}
        {isOutputExpanded ? (
          <Box className={`output-box ${type}`}>
            <pre>{outputText}</pre>
          </Box>
        ) : (
          <Box className="output-summary">
            <Text size="1" color="gray">
              {t('chat.toolApproval.outputLines', { count: summary.lines })}
            </Text>
          </Box>
        )}
      </Flex>
    );
  };

  const input = invocation.input as {
    serverId: string;
    command: string;
    reason: string;
    stopOnSuccess?: string;
    stopOnError?: string;
    maxWaitTime?: number;
  } | undefined;

  // output 现在可能是字符串或对象
  const output = invocation.output as string | {
    success: boolean;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    error?: string;
  } | undefined;

  // 状态 1: 等待用户确认
  if (invocation.state === 'approval-requested') {
    return (
      <Card className="tool-approval-card">
        <Flex direction="column" gap="3">
          {/* 标题栏 */}
          <Flex direction="row" align="center" gap="2">
            <AlertTriangle size={16} className="icon-warning" aria-hidden="true" />
            <Text size="3" weight="bold">
              {t('chat.toolApproval.states.pending.title')}
            </Text>
            <Badge color="amber" variant="soft" size="1">
              {t('chat.toolApproval.states.pending.badge')}
            </Badge>
          </Flex>

          {/* 服务器信息 */}
          <Flex direction="row" align="center" gap="2" className="server-info">
            <Server size={16} aria-hidden="true" />
            <Text size="2" color="gray">
              {serverName} ({serverHost})
            </Text>
          </Flex>

          {/* 执行理由 */}
          {input?.reason && (
            <Flex direction="column" gap="1">
              <Text size="1" weight="bold" color="gray">
                {t('chat.toolApproval.fields.reason')}:
              </Text>
              <Text size="2">{input.reason}</Text>
            </Flex>
          )}

          {/* 命令内容 */}
          {input?.command && (
            <Flex direction="column" gap="1">
              <Text size="1" weight="bold" color="gray">
                {t('chat.toolApproval.fields.command')}:
              </Text>
              <Box className="command-box">
                <Flex direction="row" align="start" gap="2">
                  <Terminal size={14} className="icon-terminal" aria-hidden="true" />
                  <Text size="2" className="command-text">
                    {input.command}
                  </Text>
                </Flex>
              </Box>
            </Flex>
          )}

          {/* 警告提示 */}
          <Box className="warning-box">
            <Text size="1" color="amber">
              {t('chat.toolApproval.warnings.executionWarning')}
            </Text>
          </Box>

          {/* 快捷选项 */}
          <Box className="quick-options">
            <Text size="1" weight="bold" color="gray" mb="2">
              {t('chat.toolApproval.quickOptions.title')}:
            </Text>
            <RadioCards.Root
              value={rememberType}
              onValueChange={(value) => setRememberType(value as ApprovalRememberType)}
              columns={{ initial: '1', sm: '1' }}
              className="quick-options-radio"
            >
              <RadioCards.Item value="none" className="quick-option-item">
                <Flex direction="column" gap="1">
                  <Text size="1" weight="medium">
                    {t('chat.toolApproval.quickOptions.none')}
                  </Text>
                </Flex>
              </RadioCards.Item>
              <RadioCards.Item value="command" className="quick-option-item">
                <Flex direction="column" gap="1">
                  <Text size="1" weight="medium">
                    {t('chat.toolApproval.quickOptions.command')}
                  </Text>
                </Flex>
              </RadioCards.Item>
              <RadioCards.Item value="server" className="quick-option-item">
                <Flex direction="column" gap="1">
                  <Text size="1" weight="medium">
                    {t('chat.toolApproval.quickOptions.server')}
                  </Text>
                </Flex>
              </RadioCards.Item>
            </RadioCards.Root>
          </Box>

          {/* 操作按钮 */}
          <Flex direction="row" gap="3" justify="end">
            <Button variant="soft" color="gray" onClick={onDeny}>
              <Flex direction="row" align="center" gap="2">
                <XCircle size={16} aria-hidden="true" />
                {t('chat.toolApproval.actions.deny')}
              </Flex>
            </Button>
            <Button
              color="red"
              onClick={() => onApprove({ rememberType })}
            >
              <Flex direction="row" align="center" gap="2">
                <CheckCircle2 size={16} aria-hidden="true" />
                {t('chat.toolApproval.actions.approve')}
              </Flex>
            </Button>
          </Flex>
        </Flex>
      </Card>
    );
  }

  // 状态 2: 执行完成，有输出
  if (invocation.state === 'output-available') {
    // 检查是否有输出（没有输出说明用户拒绝）
    if (!output) {
      return (
        <Card className="tool-rejected-card">
          <Flex direction="row" align="center" gap="3">
            <XCircle size={16} className="icon-error" aria-hidden="true" />
            <Flex direction="column" gap="1">
              <Text size="2" weight="bold" color="red">
                {t('chat.toolApproval.states.rejected.title')}
              </Text>
              {input?.command && (
                <Text size="1" color="gray" className="font-mono">
                  {input.command}
                </Text>
              )}
            </Flex>
          </Flex>
        </Card>
      );
    }

    // output 是字符串类型（简单返回）
    if (typeof output === 'string') {
      const isError = output.startsWith('错误:') || output.startsWith('Error:');
      return (
        <Card className={isError ? 'tool-error-card' : 'tool-success-card'}>
          <Flex direction="column" gap="2">
            <Flex direction="row" align="center" gap="2">
              {isError ? (
                <XCircle size={16} className="icon-error" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} className="icon-success" aria-hidden="true" />
              )}
              <Text size="2" weight="bold" color={isError ? 'red' : undefined}>
                {isError ? t('chat.toolApproval.states.error.title') : t('chat.toolApproval.states.success.title')}
              </Text>
            </Flex>

            {/* 命令 */}
            {input?.command && (
              <Text size="1" color="gray" className="font-mono">
                $ {input.command}
              </Text>
            )}

            {/* 输出 */}
            {renderOutputBox(output, isError ? 'stderr' : 'stdout')}
          </Flex>
        </Card>
      );
    }

    // output 是对象类型（兼容旧格式）
    const result = output as { success: boolean; stdout?: string; stderr?: string; error?: string };
    if (result && !result.success) {
      return (
        <Card className="tool-error-card">
          <Flex direction="column" gap="2">
            <Flex direction="row" align="center" gap="2">
              <XCircle size={16} className="icon-error" aria-hidden="true" />
              <Text size="2" weight="bold" color="red">
                {t('chat.toolApproval.states.error.title')}
              </Text>
            </Flex>
            {result.error && (
              <Text size="1" color="red">
                {t('chat.toolApproval.output.error')}: {result.error}
              </Text>
            )}
            {result.stderr && renderOutputBox(result.stderr, 'stderr')}
          </Flex>
        </Card>
      );
    }

    if (result && result.stdout) {
      return (
        <Card className="tool-success-card">
          <Flex direction="column" gap="2">
            <Flex direction="row" align="center" gap="2">
              <CheckCircle2 size={16} className="icon-success" aria-hidden="true" />
              <Text size="2" weight="bold">
                {t('chat.toolApproval.states.success.title')}
              </Text>
            </Flex>

            {input?.command && (
              <Text size="1" color="gray" className="font-mono">
                $ {input.command}
              </Text>
            )}

            {renderOutputBox(result.stdout, 'stdout')}

            {result.stderr && (
              <Flex direction="column" gap="1">
                <Text size="1" weight="bold" color="orange">
                  {t('chat.toolApproval.output.errorOutput')}:
                </Text>
                {renderOutputBox(result.stderr, 'stderr')}
              </Flex>
            )}
          </Flex>
        </Card>
      );
    }

    // 默认：直接显示 output
    return (
      <Card className="tool-success-card">
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            {t('chat.toolApproval.states.completed.title')}
          </Text>
          {renderOutputBox(String(output), 'stdout')}
        </Flex>
      </Card>
    );
  }

  return null;
}
