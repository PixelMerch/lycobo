import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { localeNames, locales, parseLocale } from "../../../i18n/locale";
import { useMessages } from "../../../i18n/messages";
import { useAccountLanguage } from "../../auth/use-account-language";
import { accountSettingsMessages } from "./account-settings-messages";

/** 选择并保存账号默认语言，沿用账户面板的分段选择控件。 */
export function AccountLanguagePicker({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountSettingsMessages);
  const { changeLanguage, isSaving } = useAccountLanguage(account);
  const saved = parseLocale(account.preferredLocale);
  return (
    <ToggleButtonGroup
      className="account-segment account-language-picker"
      aria-label={t.language}
      size="md"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={saved ? [saved] : []}
      aria-busy={isSaving}
      isDisabled={isSaving}
      onSelectionChange={(keys) => {
        const next = locales.find((locale) => keys.has(locale));
        if (next) changeLanguage(next);
      }}
    >
      {locales.map((locale) => (
        <ToggleButton key={locale} id={locale}>
          <span lang={locale}>{localeNames[locale]}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
