import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { CreditCoin } from "../../../components/credit-coin";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { creditPackDisplay, creditPacks } from "./credit-pack-pricing";
import { creditsMessages } from "./credits-messages";

/** 账户充值共用公开美元目录，通过官方单选控件选择积分包，不创建订单。 */
export function CreditPackChoices({
  selected,
  unitCredits,
  onSelect,
}: {
  selected: number;
  unitCredits: number;
  onSelect: (credits: number) => void;
}) {
  const t = useMessages(creditsMessages);
  const locale = useLocale();
  return (
    <ToggleButtonGroup
      fullWidth
      isDetached
      aria-label={t.packs}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[String(selected)]}
      onSelectionChange={(keys) => {
        const next = creditPacks.find(({ credits }) => keys.has(String(credits)));
        if (next) onSelect(next.credits);
      }}
      className="credit-pack-grid"
    >
      {creditPacks.map((pack) => {
        const display = creditPackDisplay(pack, locale, unitCredits);
        return (
          <ToggleButton
            key={pack.credits}
            id={String(pack.credits)}
            className="credit-pack"
            aria-label={t.packLabel(display.credits, display.price, display.images)}
          >
            <span className="credit-pack-value">
              <CreditCoin size="default" />
              <strong>{display.credits}</strong>
            </span>
            <span className="credit-pack-price">{display.price} USD</span>
            <span className="credit-pack-yield">{t.aboutImages(display.images)}</span>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
