import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { type ReactNode, useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { useMessages } from "../../../i18n/messages";
import { formatCredits, imagesFor } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { CreditLedger } from "../credits/credit-ledger";
import { RechargeOrders } from "../credits/recharge-orders";
import { useWallet } from "../wallet-client";
import { accountSettingsMessages } from "./account-settings-messages";

type UsageView = "ledger" | "orders";
const usageViews: UsageView[] = ["ledger", "orders"];

/** 按下的按钮作为弹窗的入口，关闭后焦点回到它。 */
function pressedElement(target: Element) {
  return target instanceof HTMLElement ? target : null;
}

/** 套餐与用量的一行：左侧标题与数值，右侧操作。 */
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

/** 套餐与用量：会员等级与升级、企业共享积分与充值，下方为积分明细和充值订单。 */
export function AccountPlanUsage() {
  const t = useMessages(accountSettingsMessages);
  const wallet = useWallet();
  const open = useAccountOverlays((state) => state.open);
  const [view, setView] = useState<UsageView>("ledger");
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  const imagesHint =
    balance === undefined ? "" : t.imagesLeft(formatCredits(imagesFor(balance, unit)));
  return (
    <div className="plan-usage">
      <PlanRow
        label={t.currentPlan}
        value={t.freePlan}
        action={
          <Button
            className="plan-usage-upgrade"
            onPress={(event) => open("membership", pressedElement(event.target))}
          >
            {t.upgrade}
          </Button>
        }
      />
      <PlanRow
        label={t.balance}
        value={
          <>
            <CreditCoin size="default" />
            {balance === undefined ? "—" : formatCredits(balance)}
          </>
        }
        hint={`${t.perImage(unit)}${imagesHint}`}
        action={
          <Button
            variant="secondary"
            className="plan-usage-recharge"
            onPress={(event) => open("recharge", pressedElement(event.target))}
          >
            {t.recharge}
          </Button>
        }
      />
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
