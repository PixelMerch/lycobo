import { Button, Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowRight, IconCreditCard, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { formatCredits, imagesFor } from "../account-format";
import { useWallet } from "../wallet-client";
import { creditsMessages } from "./credits-messages";

// 只是展示用的档位设想，不是可购买的商品，也不是已配置的商业条款。
const packs = [500, 1500, 3000, 5000, 10000, 30000, 50000, 100000, 200000];
const priceOf = (credits: number) => credits / 10;

/** 充值积分包与订单预览；支付未接入，购买按钮保持禁用。 */
export function CreditPacks() {
  const t = useMessages(creditsMessages);
  const wallet = useWallet();
  const [selected, setSelected] = useState(500);
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  return (
    <div className="credit-recharge">
      <section className="credit-packs" aria-label={t.choosePack}>
        <ToggleButtonGroup
          fullWidth
          isDetached
          aria-label={t.packs}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[String(selected)]}
          onSelectionChange={(keys) => {
            const next = packs.find((amount) => keys.has(String(amount)));
            if (next) setSelected(next);
          }}
          className="credit-pack-grid"
        >
          {packs.map((amount) => (
            <ToggleButton
              key={amount}
              id={String(amount)}
              className="credit-pack"
              aria-label={t.packLabel(
                formatCredits(amount),
                priceOf(amount),
                formatCredits(imagesFor(amount, unit)),
              )}
            >
              <span className="credit-pack-value">
                <CreditCoin size="default" />
                <strong>{formatCredits(amount)}</strong>
              </span>
              <span className="credit-pack-price">¥{formatCredits(priceOf(amount))}</span>
              <span className="credit-pack-yield">
                {t.aboutImages(formatCredits(imagesFor(amount, unit)))}
              </span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
            <dd>¥{priceOf(selected).toFixed(2)}</dd>
          </div>
          <div>
            <dt>{t.unitPrice}</dt>
            <dd>{t.perCredit((priceOf(selected) / selected).toFixed(2))}</dd>
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
