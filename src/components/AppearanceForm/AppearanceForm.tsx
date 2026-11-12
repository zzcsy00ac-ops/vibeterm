import { Flex, Select, Text, Card } from '@radix-ui/themes';
import { ThemeModeOptions,ThemeMode } from '../../schemas/settings';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from 'react-i18next';
import './AppearanceForm.css';

export function AppearanceForm() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useAppStore();

  const handleThemeModeChange = (value: ThemeMode) => {
    setThemeMode(value);
  };

  return (
    <Flex direction="column" gap="4" className="appearance-form">
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="bold">
              {t('settings.appearance.themeMode')}
            </Text>
            <Text size="1" color="gray">
              {t('settings.appearance.themeModeDescription')}
            </Text>
          </Flex>

          <Select.Root
            value={themeMode}
            onValueChange={handleThemeModeChange}
          >
            <Select.Trigger placeholder={t('settings.selectPlaceholder')} />
            <Select.Content>
              <Select.Item value={ThemeModeOptions.System}>
                {t('settings.themeMode_system')}
              </Select.Item>
              <Select.Item value={ThemeModeOptions.Light}>
                {t('settings.themeMode_light')}
              </Select.Item>
              <Select.Item value={ThemeModeOptions.Dark}>
                {t('settings.themeMode_dark')}
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Card>
    </Flex>
  );
}
