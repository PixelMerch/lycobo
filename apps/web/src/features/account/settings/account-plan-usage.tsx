import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { type ReactNode, useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { useMessages } from "../../../i18n/messages";
import { formatCredits, imagesFor } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { CreditLedger } from "../credits/credit-ledger";
import { creditsMessages } from "../credits/credits-messages";
import { RechargeOrders } from "../credits/recharge-orders";
import { useWallet } from "../wallet-client";
import { accountSettingsMessages } from "./account-settings-messages";

type UsageView = "ledger" | "orders";
const usageViews: UsageView[] = ["ledger", "orders"];

/** 按下的按钮作为弹窗的入口，关闭后焦点回到它。 */
function pressedElement(target: Element) {
  return target instanceof HTMLElement ? target : null;
}

/** 在余额旁展示充值操作和图片用量估算。 */
function PlanRow({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  action: ReactNode;
}) {
  return (
    <section className="plan-usage-row">
      <div className="plan-usage-main">
        <span className="plan-usage-label">{label}</span>
        <strong className="plan-usage-value">{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {action}
    </section>
  );
}

/** 展示积分余额、充值入口、积分明细和充值订单。 */
export function AccountPlanUsage() {
  const t = useMessages(accountSettingsMessages);
  const { walletSources } = useMessages(creditsMessages);
  const wallet = useWallet();
  const open = useAccountOverlays((state) => state.open);
  const [view, setView] = useState<UsageView>("ledger");
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  const purchased = wallet.data?.purchasedBalance;
  const imagesHint =
    balance === undefined ? "" : t.imagesLeft(formatCredits(imagesFor(balance, unit)));
  const rechargeAction = (
    <Button
      variant="secondary"
      className="plan-usage-recharge"
      onPress={(event) => open("recharge", pressedElement(event.target))}
    >
      {t.recharge}
    </Button>
  );
  return (
    <div className="plan-usage">
      <PlanRow
        label={purchased === undefined ? t.balance : walletSources.local}
        value={
          <>
            <CreditCoin size="default" />
            {balance === undefined ? "—" : formatCredits(balance)}
          </>
        }
        hint={`${t.perImage(unit)}${imagesHint}`}
        action={purchased === undefined ? rechargeAction : null}
      />
      {purchased !== undefined && (
        <PlanRow
          label={walletSources.purchased}
          value={
            <>
              <CreditCoin size="default" />
              {purchased === null ? "—" : formatCredits(purchased)}
            </>
          }
          action={rechargeAction}
        />
      )}
      <section className="plan-usage-history" aria-label={t.usage}>
        <div className="plan-usage-history-head">
          <h3>{t.usage}</h3>
          <ToggleButtonGroup
            aria-label={t.usage}
            size="sm"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[view]}
            onSelectionChange={(keys) => {
              const next = usageViews.find((id) => keys.has(id));
              if (next) setView(next);
            }}
            className="plan-usage-views"
          >
            {usageViews.map((id) => (
              <ToggleButton key={id} id={id}>
                {t.usageViews[id]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        {view === "ledger" ? <CreditLedger /> : <RechargeOrders />}
      </section>
    </div>
  );
}
