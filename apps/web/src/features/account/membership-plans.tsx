import { Button, Card, NumberField, Tabs, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconCoins, IconMinus, IconPlus } from "@tabler/icons-react";
import { useId, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { EnterpriseMembership, MembershipBenefits, MembershipInfo } from "./membership-details";
import { MembershipFaq } from "./membership-faq";
import {
  cheapestPlanId,
  creditPrice,
  discountTenths,
  lowestCreditPrice,
  lowestDiscount,
  type MembershipCycle,
  type MembershipPlan,
  membershipCycles,
  membershipPricing,
  teamMembershipPricing,
} from "./membership-pricing";

// Every figure in the headline and badges is derived from the price table, never typed by hand.
const lowestCredit = Math.min(
  ...membershipCycles.map((cycle) =>
    lowestCreditPrice([...membershipPricing, ...teamMembershipPricing], cycle.id),
  ),
);

function MembershipHero() {
  return (
    <div className="membership-hero">
      <p className="membership-hero-title">
        <span>全部图片工具通用</span>
        <em>低至 ¥{lowestCredit.toFixed(3)} / 积分</em>
      </p>
      <p className="membership-hero-note">
        会员每月获得积分额度，主图制作、家纺裂变与套图计划均可使用
      </p>
    </div>
  );
}

/** Ribbon above a card: the cheapest credit wins; otherwise a plan with several tiers says so. */
function planRibbon(plan: MembershipPlan, cheapest: string | undefined) {
  if (plan.id === cheapest) return { tone: "best", text: "积分单价最低" } as const;
  if (plan.options.length > 1)
    return { tone: "info", text: `${plan.options.length} 档额度可选` } as const;
  return null;
}

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
  const cheapest = cheapestPlanId(plans, cycle);
  return (
    <div className="membership-plan-grid">
      {plans.map((plan) => {
        const option =
          plan.options.find((item) => item.credits === selected[plan.id]) ?? plan.options[0];
        if (!option) return null;
        const price = option[cycle];
        const seatCount = seats[plan.id] ?? 2;
        const discount = discountTenths(option, cycle);
        const ribbon = planRibbon(plan, cheapest);
        return (
          <Card
            key={plan.id}
            className="membership-plan"
            data-plan={plan.id}
            data-team={team}
            data-ribbon={ribbon?.tone}
          >
            {ribbon && <p className="membership-plan-ribbon">{ribbon.text}</p>}
            <div className="membership-plan-body">
              <Card.Header>
                <Card.Title>{plan.name}</Card.Title>
                {discount < 10 && <span className="membership-plan-discount">{discount} 折</span>}
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
                  <s className="membership-original-price">
                    <span className="visually-hidden">原价</span>¥
                    {(option.original * period.months).toLocaleString("zh-CN")}
                  </s>
                </div>
                {team && (
                  <div className="membership-seat-row">
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
                    <p className="membership-seat-total">
                      {seatCount} 席位 · 合计 ¥{(price * seatCount).toLocaleString("zh-CN")}{" "}
                      {period.unit}
                    </p>
                  </div>
                )}
                <div className="membership-plan-choice">
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
                        {plan.options.map((item, index) => (
                          <ToggleButton
                            key={item.credits}
                            id={String(item.credits)}
                            aria-label={`${plan.name} ${item.credits}积分/月`}
                          >
                            {index > 0 && <ToggleButtonGroup.Separator />}
                            <UiIcon icon={IconCoins} size="small" />
                            {item.label}/月
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    ) : (
                      <span>
                        <UiIcon icon={IconCoins} size="small" />
                        {option.label}/月
                      </span>
                    )}
                  </div>
                  <Button
                    variant={ribbon?.tone === "best" ? "primary" : "secondary"}
                    isDisabled
                    className="membership-plan-action"
                    aria-label={`订阅${plan.name}`}
                  >
                    订阅
                  </Button>
                </div>
                <div className="membership-plan-gift">
                  <div className="membership-plan-credits">
                    <CreditCoin size="default" />
                    <strong>{option.credits.toLocaleString("zh-CN")}</strong>
                    <span>/ 月{team ? " / 席" : ""}</span>
                  </div>
                  <p>
                    ¥{Number((price / period.months).toFixed(1))} / 月，<em>1</em> 积分 ={" "}
                    <em>¥{creditPrice(option, cycle).toFixed(3)}</em>
                  </p>
                  <p className="membership-plan-estimate">
                    {team ? "每席" : ""}约生成{" "}
                    {Math.floor(option.credits / imageUnitCredits).toLocaleString("zh-CN")} 张图片
                    <MembershipInfo label={`${plan.name}积分说明`}>
                      {team
                        ? `按每席每月积分、每张图片 ${imageUnitCredits} 积分估算；周期价格为每席费用，合计金额随席位数变化。`
                        : `按每张图片 ${imageUnitCredits} 积分估算；实际消耗取决于模型、生成数量和参数。`}
                    </MembershipInfo>
                  </p>
                </div>
                <MembershipBenefits team={team} />
              </Card.Content>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function MembershipPlans() {
  const [cycle, setCycle] = useState<MembershipCycle>("yearly");
  const [audience, setAudience] = useState("personal");
  const hintId = useId();
  const audiencePlans = audience === "team" ? teamMembershipPricing : membershipPricing;
  return (
    <section className="membership-plans" aria-label="会员方案">
      <MembershipHero />
      <Tabs
        selectedKey={audience}
        onSelectionChange={(key) => setAudience(String(key))}
        className="membership-audiences"
      >
        <div className="membership-switcher">
          <Tabs.ListContainer>
            <Tabs.List aria-label="订阅类型">
              <Tabs.Tab id="personal">个人</Tabs.Tab>
              <Tabs.Tab id="team">团队</Tabs.Tab>
              <Tabs.Tab id="enterprise">企业</Tabs.Tab>
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
              {membershipCycles.map((item) => {
                const discount = lowestDiscount(audiencePlans, item.id);
                const hint = discount < 10 ? `${hintId}-${item.id}` : undefined;
                return (
                  <ToggleButton
                    id={item.id}
                    key={item.id}
                    aria-label={item.label}
                    {...(hint ? { "aria-describedby": hint } : {})}
                  >
                    {item.label}
                    {hint && (
                      <span id={hint} className="membership-cycle-hint">
                        最低 {discount} 折
                      </span>
                    )}
                  </ToggleButton>
                );
              })}
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
