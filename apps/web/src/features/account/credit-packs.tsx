import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";

const packs = [
  { id: "light", name: "轻量补充", description: "偶尔补充一点用量" },
  { id: "daily", name: "日常创作", description: "日常上新与商品迭代" },
  { id: "frequent", name: "高频创作", description: "持续、多批次创作" },
] as const;

/** Display only: no prices, credits or payment orders are configured yet. */
export function CreditPacks() {
  const [selected, setSelected] = useState("daily");
  const pack = packs.find((item) => item.id === selected) ?? packs[1];
  return (
    <section className="credit-packs" aria-label="选择充值积分包">
      <p className="credit-recharge-intro">按需补充创作用量，积分包可单独购买。</p>
      <ToggleButtonGroup
        fullWidth
        isDetached
        aria-label="选择积分包"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          const next = packs.find((item) => keys.has(item.id));
          if (next) setSelected(next.id);
        }}
        className="credit-pack-grid"
      >
        {packs.map((item) => (
          <ToggleButton key={item.id} id={item.id} className="credit-pack">
            <span className="credit-pack-heading">
              <CreditCoin size="action" />
              <span className="credit-pack-check">
                <UiIcon icon={IconCheck} size="small" />
              </span>
            </span>
            <strong>{item.name}</strong>
            <span className="credit-pack-description">{item.description}</span>
            <span className="credit-pack-price">价格待公布</span>
            <span className="credit-pack-amount">积分额度待公布</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="credit-pack-checkout">
        <div>
          <span>已选择</span>
          <strong>{pack.name}</strong>
        </div>
        <Button variant="primary" className="credit-pack-submit" isDisabled>
          充值即将开放
        </Button>
      </div>
      <p className="credit-recharge-note">
        单独充值只增加积分，不改变会员等级。价格、额度及有效期将在开放时公布。
      </p>
    </section>
  );
}
