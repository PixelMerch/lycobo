import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";

// Visual proposals only; these are not purchasable SKUs or configured commercial terms.
const packs = [500, 1500, 3000, 5000, 10000, 30000, 50000, 100000, 200000];

export function CreditPacks() {
  const [selected, setSelected] = useState("500");
  return (
    <section className="credit-packs" aria-label="选择充值积分包">
      <p className="credit-recharge-intro">方案预览 · 积分档位与价格待确认</p>
      <ToggleButtonGroup
        fullWidth
        isDetached
        aria-label="选择积分包"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          const next = packs.find((amount) => keys.has(String(amount)));
          if (next) setSelected(String(next));
        }}
        className="credit-pack-grid"
      >
        {packs.map((amount) => (
          <ToggleButton
            key={amount}
            id={String(amount)}
            className="credit-pack"
            aria-label={`${amount.toLocaleString("zh-CN")} 积分，示例价格 ${amount / 10} 元`}
          >
            <span className="credit-pack-value">
              <CreditCoin size="action" />
              <strong>{amount.toLocaleString("zh-CN")}</strong>
            </span>
            <span className="credit-pack-price">¥{(amount / 10).toLocaleString("zh-CN")}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="credit-pack-checkout">
        <Button variant="primary" className="credit-pack-submit" isDisabled>
          充值即将开放
        </Button>
      </div>
      <p className="credit-recharge-note">
        积分用于创作消耗，购买积分不改变会员等级。正式价格、额度及有效期将在开放时公布。
      </p>
    </section>
  );
}
