import { Button, Chip } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowRight, IconCreditCard, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { formatCredits, imagesFor } from "../account-format";
import { useWallet } from "../wallet-client";
import { CreditPackChoices } from "./credit-pack-choices";
import { creditPackDisplay, creditPacks, defaultCreditPack } from "./credit-pack-pricing";
import { creditsMessages } from "./credits-messages";

/** 充值展示与首页一致的美元积分包和余额估算；支付未接入，购买按钮保持禁用。 */
export function CreditPacks() {
  const t = useMessages(creditsMessages);
  const wallet = useWallet();
  const locale = useLocale();
  const [selected, setSelected] = useState<number>(defaultCreditPack.credits);
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  const pack = creditPacks.find(({ credits }) => credits === selected) ?? defaultCreditPack;
  const display = creditPackDisplay(pack, locale, unit);
  return (
    <div className="credit-recharge">
      <section className="credit-packs" aria-label={t.choosePack}>
        <CreditPackChoices selected={selected} unitCredits={unit} onSelect={setSelected} />
        <p className="credit-recharge-note">{t.rechargeNote}</p>
      </section>
      <section className="credit-order" aria-labelledby="credit-order-heading">
        <h3 id="credit-order-heading">{t.orderPreview}</h3>
        <dl className="credit-order-rows">
          <div>
            <dt>{t.buyCredits}</dt>
            <dd>{formatCredits(selected)}</dd>
          </div>
          <div>
            <dt>{t.amountDue}</dt>
            <dd>{display.price} USD</dd>
          </div>
          <div>
            <dt>{t.unitPrice}</dt>
            <dd>{t.perCredit(display.rate)}</dd>
          </div>
        </dl>
        <div className="credit-order-after">
          <span>{t.creditsAfter}</span>
          {balance === undefined ? (
            <strong>—</strong>
          ) : (
            <strong>
              {formatCredits(balance)}
              <UiIcon icon={IconArrowRight} size="small" />
              <b>{formatCredits(balance + selected)}</b>
            </strong>
          )}
          <small>
            {balance === undefined
              ? t.balanceUnavailable
              : t.imagesAfter(formatCredits(imagesFor(balance + selected, unit)), unit)}
          </small>
        </div>
        <p className="credit-order-label">{t.paymentMethod}</p>
        <div className="credit-order-payment">
          <UiIcon icon={IconCreditCard} />
          {t.onlinePayment}
          <Chip size="sm" className="account-chip">
            {t.comingSoon}
          </Chip>
        </div>
        <Button variant="primary" className="credit-pack-submit" isDisabled>
          {t.buyNow}
        </Button>
        <p className="credit-order-preview">
          <UiIcon icon={IconInfoCircle} size="small" />
          {t.notForSale}
        </p>
      </section>
    </div>
  );
}
