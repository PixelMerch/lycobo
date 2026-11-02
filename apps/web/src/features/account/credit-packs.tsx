import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";

const packs = [
  { id: "light", name: "轻量补充", description: "补充少量创作，灵活试用。" },
  { id: "daily", name: "日常创作", description: "应对日常上新与商品图迭代。" },
  { id: "frequent", name: "高频创作", description: "为持续、多批次创作补充用量。" },
] as const;

export function CreditPacks() {
  const [selected, setSelected] = useState("daily");
  const pack = packs.find((item) => item.id === selected) ?? packs[1];
  return (
    <section className="credit-packs" aria-label="积分充值">
      <div className="membership-section-heading">
        <div>
          <h3>需要更多用量时，再补充积分</h3>
          <p>积分包独立购买，用于生成消耗；购买积分不会改变会员等级。</p>
        </div>
      </div>
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
            <span className="credit-pack-amount">积分额度待公布</span>
            <span className="credit-pack-price">价格待公布</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="credit-pack-checkout">
        <div>
          <span>已选积分包</span>
          <strong>{pack.name}</strong>
          <p className="credit-pack-terms">额度、价格及有效期将在开放时公布。</p>
        </div>
        <Button variant="primary" className="credit-pack-submit" isDisabled>
          充值即将开放
        </Button>
      </div>
      <div className="membership-availability">
        <UiIcon icon={IconInfoCircle} />
        <div>
          <strong>用量与权限分别管理</strong>
          <p className="membership-availability-description">
            开通会员可获得对应权益与赠送积分；单独充值只补充积分。会员专属功能仍需相应会员资格。
          </p>
        </div>
      </div>
    </section>
  );
}
