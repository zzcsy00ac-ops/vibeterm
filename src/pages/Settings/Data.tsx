/**
 * Data Settings Page
 *
 * Settings for data import/export and backup management
 */

import { Heading, Text, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { DataForm } from '../../components/DataForm/DataForm';

export default function Data() {
  const { t } = useTranslation();

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="6">{t('settings.data.title')}</Heading>
        <Text color="gray">{t('settings.data.description')}</Text>
      </Flex>

      <DataForm />
    </Flex>
  );
}
