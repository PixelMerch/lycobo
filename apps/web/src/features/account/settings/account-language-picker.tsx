import { ListBox, Select } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { localeNames, locales, parseLocale } from "../../../i18n/locale";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useAccountLanguage } from "../../auth/use-account-language";
import { accountSettingsMessages } from "./account-settings-messages";

/** 用下拉列表选择账号语言，按站点支持的语言生成选项。 */
export function AccountLanguagePicker({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountSettingsMessages);
  const current = useLocale();
  const { changeLanguage, isSaving } = useAccountLanguage(account);
  return (
    <Select
      className="account-language-picker"
      aria-label={t.language}
      placeholder={localeNames[current]}
      value={parseLocale(account.preferredLocale)}
      aria-busy={isSaving}
      isDisabled={isSaving}
      onChange={(value) => {
        const next = parseLocale(value);
        if (next) changeLanguage(next);
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="choice-menu" placement="bottom end" offset={4}>
        <ListBox>
          {locales.map((locale) => (
            <ListBox.Item key={locale} id={locale} textValue={localeNames[locale]}>
              <span lang={locale}>{localeNames[locale]}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
