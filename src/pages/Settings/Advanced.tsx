/**
 * Settings - 联系我们页面
 *
 * 展示持续更新说明和反馈渠道
 * 根据语言环境显示对应的二维码（英文用 Telegram，中文用微信）
 */

import { Heading, Text, Flex, Box } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import "./Contact.css";

export default function Advanced() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  // 根据语言选择二维码
  const qrCodeImage = currentLang === 'cn'
    ? '/images/wechat_contact.jpg'
    : '/images/tg_contact.jpeg';

  // 根据语言选择平台名称
  const platformName = currentLang === 'cn' ? '微信' : 'Telegram';

  return (
    <Flex direction="column" gap="2" className="contact-page">
      {/* 感谢文案 */}
      <Flex direction="column" gap="2" align="center" className="contact-intro">
        <Heading size="5" align="center">
          {t('settings.contact.thankYou')}
        </Heading>
        <Text color="gray" size="3" align="center">
          {t('settings.contact.continuousUpdate')}
        </Text>
      </Flex>

      {/* 分隔线 */}
      <Box className="contact-divider" />

      {/* 二维码区域 */}
      <Flex direction="column" gap="3" align="center" className="qr-section">
        <Text size="4" weight="medium">
          {t('settings.contact.scanQrCode', { platform: platformName })}
        </Text>

        <Box className="qr-code-wrapper">
          <img
            src={qrCodeImage}
            alt={`${platformName} QR Code`}
            className="qr-code-image"
          />
        </Box>

        <Text color="gray" size="3" align="center">
          {t('settings.contact.communityMessage')}
        </Text>
      </Flex>

      {/* 额外信息 */}
      <Flex direction="column" gap="2" className="contact-footer">
        <Text color="gray" size="2" align="center">
          {t('settings.contact.feedbackMessage')}
        </Text>
      </Flex>
    </Flex>
  );
}
