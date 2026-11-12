import { Flex } from "@radix-ui/themes";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SETTINGS_NAV_CONFIG } from "../../config/layout";
import "./Settings.css";

export function SettingsNav() {
  const { t } = useTranslation();

  const navItems = [
    { path: "general", label: t('settings.nav.general') },
    { path: "appearance", label: t('settings.nav.appearance') },
    { path: "skills", label: t('settings.nav.skills' as any, 'Skills') },
    { path: "data", label: t('settings.nav.data') },
    { path: "contact", label: t('settings.nav.contact') },
  ];

  return (
    <Flex direction="column" gap="2" width={SETTINGS_NAV_CONFIG.width} className="settings-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `settings-nav-link ${isActive ? "active" : ""}`
          }
        >
          {item.label as React.ReactNode}
        </NavLink>
      ))}
    </Flex>
  );
}
