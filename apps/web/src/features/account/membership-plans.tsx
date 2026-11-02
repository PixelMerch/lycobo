import { Button, Card, NumberField, Tabs, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { EnterpriseMembership, MembershipBenefits, MembershipInfo } from "./membership-details";
import { MembershipFaq } from "./membership-faq";
import {
  type MembershipCycle,
  type MembershipPlan,
  membershipCycles,
  membershipPricing,
  teamMembershipPricing,
} from "./membership-pricing";

function MembershipPlanCards({
  plans,
  cycle,
  team = false,
}: {
  plans: readonly MembershipPlan[];
  cycle: MembershipCycle;
  team?: boolean;
}) {
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, number>>({ pro: 13550, apex: 31860 });
  const period = membershipCycles.find((item) => item.id === cycle) ?? membershipCycles[0];
  return (
    <div className="membership-plan-grid">
      {plans.map((plan) => {
        const option =
          plan.options.find((item) => item.credits === selected[plan.id]) ?? plan.options[0];
        if (!option) return null;
        const price = option[cycle];
        const seatCount = seats[plan.id] ?? 2;
        const monthlyPrice = price / period.months;
        return (
          <Card key={plan.id} className="membership-plan" data-plan={plan.id} data-team={team}>
            <Card.Header>
              <Card.Title>{plan.name}</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="membership-plan-price">
                <strong>
                  <small>¥</small>
                  {price.toLocaleString("zh-CN")}
                </strong>
                <span>
                  {period.unit}
                  {team ? " / 席" : ""}
                </span>
              </div>
              <div className="membership-original-price">
                <s>¥{(option.original * period.months).toLocaleString("zh-CN")}</s>
              </div>
              {team && (
                <NumberField
                  aria-label={`${plan.name}席位`}
                  minValue={2}
                  maxValue={99}
                  value={seatCount}
                  onChange={(value) => {
                    if (Number.isFinite(value))
                      setSeats((previous) => ({ ...previous, [plan.id]: value }));
                  }}
                  className="membership-seats"
                >
                  <NumberField.Group>
                    <NumberField.DecrementButton aria-label={`减少${plan.name}席位`}>
                      <UiIcon icon={IconMinus} size="small" />
                    </NumberField.DecrementButton>
                    <NumberField.Input />
                    <NumberField.IncrementButton aria-label={`增加${plan.name}席位`}>
                      <UiIcon icon={IconPlus} size="small" />
                    </NumberField.IncrementButton>
                  </NumberField.Group>
                </NumberField>
              )}
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
                  <span>/ 月{team ? " / 席" : ""}</span>
                  <MembershipInfo label={`${plan.name}积分说明`}>
                    {team
                      ? "按每席每月展示积分额度，周期价格为每席费用，合计金额随席位数变化。"
                      : "套餐显示每月积分额度，实际创作消耗取决于模型、生成数量和参数。"}
                  </MembershipInfo>
                </div>
                <p>
                  ¥{Number(monthlyPrice.toFixed(1))} / 月，1 积分 = ¥
                  {(monthlyPrice / option.credits).toFixed(3)}
                </p>
              </div>
              {team && (
                <p className="membership-seat-total">
                  {seatCount} 席位 · 合计 ¥{(price * seatCount).toLocaleString("zh-CN")}
                  {period.unit}
                </p>
              )}
              <Button
                variant={plan.id === "apex" || plan.id === "team-max" ? "primary" : "secondary"}
                isDisabled
                className="membership-plan-action"
                aria-label={`订阅${plan.name}`}
              >
                订阅
              </Button>
              <MembershipBenefits team={team} />
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
}

export function MembershipPlans() {
  const [cycle, setCycle] = useState<MembershipCycle>("yearly");
  const [audience, setAudience] = useState("personal");
  return (
    <section className="membership-plans" aria-label="会员方案">
      <Tabs
        selectedKey={audience}
        onSelectionChange={(key) => setAudience(String(key))}
        className="membership-audiences"
      >
        <div className="membership-switcher">
          <Tabs.ListContainer>
            <Tabs.List aria-label="订阅类型">
              <Tabs.Tab id="personal">
                个人
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="team">
                团队
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="enterprise">
                企业
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          {audience !== "enterprise" && (
            <ToggleButtonGroup
              aria-label="会员周期"
              selectedKeys={[cycle]}
              selectionMode="single"
              disallowEmptySelection
              className="membership-cycle"
              size="sm"
              onSelectionChange={(keys) => {
                const next = membershipCycles.find((item) => keys.has(item.id));
                if (next) setCycle(next.id);
              }}
            >
              {membershipCycles.map((item) => (
                <ToggleButton id={item.id} key={item.id}>
                  {item.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </div>
        <Tabs.Panel id="personal">
          <MembershipPlanCards plans={membershipPricing} cycle={cycle} />
        </Tabs.Panel>
        <Tabs.Panel id="team">
          <MembershipPlanCards plans={teamMembershipPricing} cycle={cycle} team />
        </Tabs.Panel>
        <Tabs.Panel id="enterprise">
          <EnterpriseMembership />
        </Tabs.Panel>
      </Tabs>
      <MembershipFaq />
    </section>
  );
}
