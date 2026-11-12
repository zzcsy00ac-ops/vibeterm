import { Heading, Text, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { GeneralForm } from "../../components/GeneralForm/GeneralForm";

export default function General() {
  const { t } = useTranslation();

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="6">{t('settings.general.title')}</Heading>
        <Text color="gray">{t('settings.general.description')}</Text>
      </Flex>

      <GeneralForm />
    </Flex>
  );
}
