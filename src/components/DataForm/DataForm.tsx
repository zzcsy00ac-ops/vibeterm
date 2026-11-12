/**
 * Data Import/Export Form Component
 *
 * Provides UI for backing up and restoring all application data
 */

import { Button, Flex, Text, Card, Separator, Dialog, Callout, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Upload,
  Info,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  FileWarning,
} from 'lucide-react';
import { useBackup } from '../../hooks/useBackup';
import { useEffect, useState } from 'react';
import './DataForm.css';

export function DataForm() {
  const { t } = useTranslation();
  const { state, exportBackup, importBackup, reset } = useBackup();

  // Dialog state for showing results
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  const handleExport = () => {
    reset();
    exportBackup();
  };

  const handleImport = () => {
    reset();
    importBackup({ replaceExisting: true });
  };

  const handleReset = () => {
    reset();
    setResultDialogOpen(false);
  };

  // Auto-open result dialog when operation completes (with delay to show the animation)
  useEffect(() => {
    if (state.status === 'success' || state.status === 'error') {
      const timer = setTimeout(() => {
        setResultDialogOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  // Render success content
  const renderSuccessContent = () => (
    <>
      <Flex align="center" gap="3" mb="2">
        <CheckCircle2 width="32" height="32" color="var(--grass-11)" />
        <Text size="4" weight="bold">
          {t('settings.data.status.success')}
        </Text>
      </Flex>

      {state.message && (
        <Text size="2" color="gray">
          {state.message}
        </Text>
      )}

      {state.validationResult?.metadata && (
        <Flex direction="column" gap="2" mt="4">
          <Callout.Root size="1">
            <Callout.Text>
              <Flex direction="column" gap="1">
                <Text size="2" weight="bold">
                  {t('settings.data.validation.backupInfo')}
                </Text>
                <Text size="2" color="gray">
                  {t('settings.data.validation.stores')}: {state.validationResult.metadata.providerCount}
                </Text>
                <Text size="2" color="gray">
                  {t('settings.data.validation.version')}: {state.validationResult.metadata.version}
                </Text>
                <Text size="2" color="gray">
                  {t('settings.data.validation.date')}: {new Date(state.validationResult.metadata.createdAt).toLocaleString()}
                </Text>
                {state.validationResult.providers.length > 0 && (
                  <>
                    <Text size="2" weight="bold" mt="1">
                      {t('settings.data.validation.includedStores')}
                    </Text>
                    {state.validationResult.providers.map((store, index) => (
                      <Text size="2" color="gray" key={index}>
                        • {store.name}
                      </Text>
                    ))}
                  </>
                )}
              </Flex>
            </Callout.Text>
          </Callout.Root>
        </Flex>
      )}
    </>
  );

  // Render error content with detailed diagnostics
  const renderErrorContent = () => {
    const validationResult = state.validationResult;

    // Copy error details to clipboard
    const copyErrorDetails = () => {
      const details = [
        `Error: ${state.error || 'Unknown error'}`,
        validationResult?.zipContents?.length
          ? `ZIP Contents:\n${validationResult.zipContents.map(f => `  - ${f}`).join('\n')}`
          : null,
        validationResult?.suggestions?.length
          ? `Suggestions:\n${validationResult.suggestions.map(s => `  - ${s}`).join('\n')}`
          : null,
      ].filter(Boolean).join('\n\n');

      navigator.clipboard.writeText(details);
    };

    return (
      <>
        <Flex align="center" gap="3" mb="2">
          <XCircle width="32" height="32" color="var(--red-11)" />
          <Text size="4" weight="bold">
            {t('settings.data.status.error')}
          </Text>
        </Flex>

        {/* Main error message */}
        <Callout.Root size="1" variant="soft" color="red">
          <Callout.Icon>
            <AlertTriangle />
          </Callout.Icon>
          <Callout.Text>
            <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
              {state.error || t('settings.data.status.error')}
            </Text>
          </Callout.Text>
        </Callout.Root>

        {/* ZIP contents (for diagnosis) */}
        {validationResult?.zipContents && validationResult.zipContents.length > 0 && (
          <Box mt="3">
            <Flex align="center" gap="2" mb="2">
              <FileWarning width="16" height="16" color="var(--gray-11)" />
              <Text size="2" weight="bold" color="gray">
                {t('settings.data.error.zipContents')}
              </Text>
            </Flex>
            <Card size="1" variant="surface" style={{ maxHeight: '120px', overflow: 'auto' }}>
              {validationResult.zipContents.map((file, index) => (
                <Text key={index} size="1" color="gray" as="p" style={{ margin: '2px 0' }}>
                  • {file}
                </Text>
              ))}
            </Card>
          </Box>
        )}

        {/* Suggestions */}
        {validationResult?.suggestions && validationResult.suggestions.length > 0 && (
          <Box mt="3">
            <Text size="2" weight="bold" color="gray" mb="2">
              {t('settings.data.error.suggestions')}
            </Text>
            <Flex direction="column" gap="1">
              {validationResult.suggestions.map((suggestion, index) => (
                <Text key={index} size="2" color="gray">
                  {index + 1}. {suggestion}
                </Text>
              ))}
            </Flex>
          </Box>
        )}

        {/* Copy button */}
        {(validationResult?.zipContents || validationResult?.suggestions) && (
          <Flex mt="3">
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={copyErrorDetails}
            >
              <Copy width="14" height="14" />
              {t('settings.data.error.copyDetails')}
            </Button>
          </Flex>
        )}
      </>
    );
  };

  return (
    <Flex direction="column" gap="4" className="data-form">
      {/* Export Section */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Flex align="center" gap="2">
              <Text as="label" size="2" weight="bold">
                {t('settings.data.export.title')}
              </Text>
            </Flex>
            <Text size="1" color="gray">
              {t('settings.data.export.description')}
            </Text>
          </Flex>

          <Flex gap="2">
            <Button
              onClick={handleExport}
              disabled={state.isLoading}
              variant="soft"
              color="blue"
            >
              <Download />
              {t('settings.data.export.button')}
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Separator size="4" />

      {/* Import Section */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Flex align="center" gap="2">
              <Text as="label" size="2" weight="bold">
                {t('settings.data.import.title')}
              </Text>
            </Flex>
            <Text size="1" color="gray">
              {t('settings.data.import.description')}
            </Text>
          </Flex>

          <Flex gap="2">
            <Button
              onClick={handleImport}
              disabled={state.isLoading}
              variant="soft"
              color="grass"
            >
              <Upload />
              {t('settings.data.import.button')}
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Separator size="4" />

      {/* Loading State */}
      {state.isLoading && (
        <Card size="2">
          <Flex gap="3" align="center">
            <RotateCw className="spin" width="20" height="20" />
            <Text size="2" color="gray">
              {state.status === 'exporting' && t('settings.data.status.exporting')}
              {state.status === 'importing' && t('settings.data.status.importing')}
              {state.status === 'validating' && t('settings.data.status.validating')}
            </Text>
          </Flex>
        </Card>
      )}

      {/* Info Section */}
      <Card size="2" variant="classic">
        <Flex gap="2" align="start">
          <Info width="20" height="20" color="var(--gray-11)" />
          <Flex direction="column" gap="2">
            <Text size="2" weight="bold">
              {t('settings.data.info.title')}
            </Text>
            <Text size="1" color="gray">
              {t('settings.data.info.content')}
            </Text>
          </Flex>
        </Flex>
      </Card>

      {/* Result Dialog - Shows success or error */}
      <Dialog.Root open={resultDialogOpen} onOpenChange={(open) => {
        setResultDialogOpen(open);
        if (!open) handleReset();
      }}>
        <Dialog.Content maxWidth="550px">
          <Dialog.Title>
            {state.status === 'success' ? t('settings.data.status.success') : t('settings.data.status.error')}
          </Dialog.Title>

          <Flex direction="column" gap="4" mt="4">
            {state.status === 'success' ? renderSuccessContent() : renderErrorContent()}
          </Flex>

          <Flex gap="3" mt="6">
            <Dialog.Close>
              <Button variant="soft">
                {t('common.buttons.close')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
