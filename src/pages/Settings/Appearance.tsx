import { Heading, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { AppearanceForm } from '../../components/AppearanceForm/AppearanceForm';

export default function Appearance() {
  const { t } = useTranslation();

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="1">
        <Heading size="6">{t('settings.appearance.title')}</Heading>
      </Flex>

      <AppearanceForm />
    </Flex>
  );
}
