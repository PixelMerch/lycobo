import { Button, Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowRight, IconCreditCard, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { formatCredits, imagesFor } from "../account-format";
import { useWallet } from "../wallet-client";

// Visual proposals only; these are not purchasable SKUs or configured commercial terms.
const packs = [500, 1500, 3000, 5000, 10000, 30000, 50000, 100000, 200000];
const priceOf = (credits: number) => credits / 10;

export function CreditPacks() {
  const wallet = useWallet();
  const [selected, setSelected] = useState(500);
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  return (
    <div className="credit-recharge">
      <section className="credit-packs" aria-label="选择充值积分包">
        <ToggleButtonGroup
          fullWidth
          isDetached
          aria-label="选择积分包"
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
              aria-label={`${formatCredits(amount)} 积分，示例价格 ${priceOf(amount)} 元，约 ${formatCredits(imagesFor(amount, unit))} 张`}
            >
              <span className="credit-pack-value">
                <CreditCoin size="default" />
                <strong>{formatCredits(amount)}</strong>
              </span>
              <span className="credit-pack-price">¥{formatCredits(priceOf(amount))}</span>
              <span className="credit-pack-yield">
                约 {formatCredits(imagesFor(amount, unit))} 张
              </span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <p className="credit-recharge-note">
          积分用于创作消耗，充值积分不改变会员等级；生成失败的积分按张自动退回。
        </p>
      </section>
      <section className="credit-order" aria-labelledby="credit-order-heading">
        <h3 id="credit-order-heading">订单预览</h3>
        <dl className="credit-order-rows">
          <div>
            <dt>购买积分</dt>
            <dd>{formatCredits(selected)}</dd>
          </div>
          <div>
            <dt>应付金额</dt>
            <dd>¥{priceOf(selected).toFixed(2)}</dd>
          </div>
          <div>
            <dt>单价</dt>
            <dd>¥{(priceOf(selected) / selected).toFixed(2)} / 积分</dd>
          </div>
        </dl>
        <div className="credit-order-after">
          <span>充值后企业共享积分</span>
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
              ? "余额暂不可用，读取后显示"
              : `约可生成 ${formatCredits(imagesFor(balance + selected, unit))} 张（每张 ${unit} 积分）`}
          </small>
        </div>
        <p className="credit-order-label">支付方式</p>
        <div className="credit-order-payment">
          <UiIcon icon={IconCreditCard} />
          在线支付
          <Chip size="sm" className="account-chip">
            待开放
          </Chip>
        </div>
        <Button variant="primary" className="credit-pack-submit" isDisabled>
          立即购买
        </Button>
        <p className="credit-order-preview">
          <UiIcon icon={IconInfoCircle} size="small" />
          积分档位与价格待公布，暂未开放购买
        </p>
      </section>
    </div>
  );
}
