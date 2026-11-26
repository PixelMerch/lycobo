import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { type WalletSource, walletSourceSchema } from "@lycoboai/contracts";
import { useMessages } from "../../../i18n/messages";
import { creditsMessages } from "./credits-messages";

/** 在同一账单内切换站内和购买流水，两个钱包始终独立分页。 */
export function CreditWalletSwitch({
  value,
  onChange,
}: {
  value: WalletSource;
  onChange: (value: WalletSource) => void;
}) {
  const t = useMessages(creditsMessages);
  return (
    <ToggleButtonGroup
      aria-label={t.walletSource}
      size="sm"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = walletSourceSchema.options.find((key) => keys.has(key));
        if (next) onChange(next);
      }}
      className="account-segment"
    >
      {walletSourceSchema.options.map((key) => (
        <ToggleButton key={key} id={key}>
          {t.walletSources[key]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
