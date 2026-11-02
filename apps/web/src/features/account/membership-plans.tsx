import { Button, Card, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { type MembershipCycle, membershipCycles, membershipPricing } from "./membership-pricing";

export function MembershipPlans() {
  const [cycle, setCycle] = useState<MembershipCycle>("yearly");
  const [selected, setSelected] = useState<Record<string, number>>({ pro: 13550, apex: 31860 });
  const period = membershipCycles.find((item) => item.id === cycle) ?? membershipCycles[0];
  return (
    <section className="membership-plans" aria-label="会员方案">
      <div className="membership-section-heading">
        <ToggleButtonGroup
          aria-label="会员周期"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[cycle]}
          onSelectionChange={(keys) => {
            const next = membershipCycles.find((item) => keys.has(item.id));
            if (next) setCycle(next.id);
          }}
          className="membership-cycle"
          size="sm"
        >
          {membershipCycles.map((item) => (
            <ToggleButton key={item.id} id={item.id}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <div className="membership-plan-grid">
        {membershipPricing.map((plan) => {
          const option =
            plan.options.find((item) => item.credits === selected[plan.id]) ?? plan.options[0];
          const price = option[cycle];
          const monthlyPrice = price / period.months;
          return (
            <Card key={plan.id} className="membership-plan" data-plan={plan.id}>
              <Card.Header>
                <Card.Title>{plan.name}</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="membership-plan-price">
                  <strong>
                    <small>¥</small>
                    {price.toLocaleString("zh-CN")}
                  </strong>
                  <span>{period.unit}</span>
                </div>
                <div className="membership-original-price">
                  <s>¥{(option.original * period.months).toLocaleString("zh-CN")}</s>
                </div>
                <div className="membership-quota-select">
                  {plan.options.length > 1 ? (
                    <ToggleButtonGroup
                      aria-label={`${plan.name}积分档位`}
                      size="sm"
                      fullWidth
                      selectionMode="single"
                      disallowEmptySelection
                      selectedKeys={[String(option.credits)]}
                      onSelectionChange={(keys) => {
                        const next = plan.options.find((item) => keys.has(String(item.credits)));
                        if (next)
                          setSelected((previous) => ({ ...previous, [plan.id]: next.credits }));
                      }}
                    >
                      {plan.options.map((item) => (
                        <ToggleButton
                          key={item.credits}
                          id={String(item.credits)}
                          aria-label={`${plan.name} ${item.credits}积分/月`}
                        >
                          {item.label}/月
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  ) : (
                    <span>
                      <CreditCoin size="default" />
                      {option.label}/月
                    </span>
                  )}
                </div>
                <div className="membership-plan-gift">
                  <div>
                    <CreditCoin size="default" />
                    <strong>{option.credits.toLocaleString("zh-CN")}</strong>
                    <span>/ 月</span>
                  </div>
                  <p>
                    ¥{Number(monthlyPrice.toFixed(1))} / 月，1 积分 = ¥
                    {(monthlyPrice / option.credits).toFixed(3)}
                  </p>
                </div>
                <Button
                  variant={plan.id === "apex" ? "primary" : "secondary"}
                  isDisabled
                  className="membership-plan-action"
                  aria-label={`订阅${plan.name}`}
                >
                  订阅
                </Button>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
