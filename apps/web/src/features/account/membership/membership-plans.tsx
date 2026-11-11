import { Button, Card, NumberField, Tabs, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconCoins, IconMinus, IconPlus } from "@tabler/icons-react";
import { useId, useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import type { Locale } from "../../../i18n/locale";
import { useMessages } from "../../../i18n/messages";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { formatNumber } from "../account-format";
import { EnterpriseMembership, MembershipBenefits, MembershipInfo } from "./membership-details";
import { MembershipFaq } from "./membership-faq";
import { membershipMessages } from "./membership-messages";
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

const audiences = ["personal", "team", "enterprise"] as const;
type MembershipText = (typeof membershipMessages)[Locale];

// Every figure in the headline and badges is derived from the price table, never typed by hand.
const lowestCredit = Math.min(
  ...membershipCycles.map((cycle) =>
    lowestCreditPrice([...membershipPricing, ...teamMembershipPricing], cycle.id),
  ),
);

function MembershipHero() {
  const t = useMessages(membershipMessages);
  return (
    <div className="membership-hero">
      <p className="membership-hero-title">
        <span>{t.heroTitle}</span>
        <em>{t.heroPrice(lowestCredit.toFixed(3))}</em>
      </p>
      <p className="membership-hero-note">{t.heroNote}</p>
    </div>
  );
}

/** 方案卡顶部的标签：积分单价最低的方案优先，其次是有多档额度可选的方案。 */
function planRibbon(plan: MembershipPlan, cheapest: string | undefined, t: MembershipText) {
  if (plan.id === cheapest) return { tone: "best", text: t.cheapestCredit } as const;
  if (plan.options.length > 1)
    return { tone: "info", text: t.tierCount(plan.options.length) } as const;
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
  const t = useMessages(membershipMessages);
  const period = membershipCycles.find((item) => item.id === cycle) ?? membershipCycles[0];
  const unit = t.cycleUnits[cycle];
  const cheapest = cheapestPlanId(plans, cycle);
  function changeSeats(id: string, value: number) {
    if (Number.isFinite(value)) setSeats((previous) => ({ ...previous, [id]: value }));
  }
  return (
    <div className="membership-plan-grid">
      {plans.map((plan) => {
        const option =
          plan.options.find((item) => item.credits === selected[plan.id]) ?? plan.options[0];
        if (!option) return null;
        const price = option[cycle];
        const seatCount = seats[plan.id] ?? 2;
        const discount = discountTenths(option, cycle);
        const ribbon = planRibbon(plan, cheapest, t);
        const seatLabel = team ? t.perSeat : "";
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
                {discount < 10 && (
                  <span className="membership-plan-discount">{t.discount(discount)}</span>
                )}
              </Card.Header>
              <Card.Content>
                <div className="membership-plan-price">
                  <strong>
                    <small>¥</small>
                    {formatNumber(price)}
                  </strong>
                  <span>
                    {unit}
                    {seatLabel}
                  </span>
                  <s className="membership-original-price">
                    <span className="visually-hidden">{t.originalPrice}</span>¥
                    {formatNumber(option.original * period.months)}
                  </s>
                </div>
                {team && (
                  <div className="membership-seat-row">
                    <NumberField
                      aria-label={t.seats(plan.name)}
                      minValue={2}
                      maxValue={99}
                      value={seatCount}
                      onChange={(value) => changeSeats(plan.id, value)}
                      className="membership-seats"
                    >
                      <NumberField.Group>
                        <NumberField.DecrementButton aria-label={t.removeSeat(plan.name)}>
                          <UiIcon icon={IconMinus} size="small" />
                        </NumberField.DecrementButton>
                        <NumberField.Input />
                        <NumberField.IncrementButton aria-label={t.addSeat(plan.name)}>
                          <UiIcon icon={IconPlus} size="small" />
                        </NumberField.IncrementButton>
                      </NumberField.Group>
                    </NumberField>
                    <p className="membership-seat-total">
                      {t.seatTotal(seatCount, formatNumber(price * seatCount), unit)}
                    </p>
                  </div>
                )}
                <div className="membership-plan-choice">
                  <PlanQuotaSelect
                    plan={plan}
                    option={option}
                    onSelect={(credits) =>
                      setSelected((previous) => ({ ...previous, [plan.id]: credits }))
                    }
                  />
                  <Button
                    variant={ribbon?.tone === "best" ? "primary" : "secondary"}
                    isDisabled
                    className="membership-plan-action"
                    aria-label={t.subscribeTo(plan.name)}
                  >
                    {t.subscribe}
                  </Button>
                </div>
                <div className="membership-plan-gift">
                  <div className="membership-plan-credits">
                    <CreditCoin size="default" />
                    <strong>{formatNumber(option.credits)}</strong>
                    <span>
                      {t.perMonth}
                      {seatLabel}
                    </span>
                  </div>
                  <p>
                    {t.monthlyCreditPrice(Number((price / period.months).toFixed(1)))}
                    <em>1</em>
                    {t.creditEquals}
                    <em>¥{creditPrice(option, cycle).toFixed(3)}</em>
                  </p>
                  <p className="membership-plan-estimate">
                    {t.estimate(team, formatNumber(Math.floor(option.credits / imageUnitCredits)))}
                    <MembershipInfo label={t.creditsInfo(plan.name)}>
                      {team
                        ? t.teamEstimateNote(imageUnitCredits)
                        : t.personalEstimateNote(imageUnitCredits)}
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

/** 会员方案：个人、团队与企业三类，个人和团队可切换周期；订阅尚未开放。 */
export function MembershipPlans() {
  const t = useMessages(membershipMessages);
  const [cycle, setCycle] = useState<MembershipCycle>("yearly");
  const [audience, setAudience] = useState("personal");
  const hintId = useId();
  const audiencePlans = audience === "team" ? teamMembershipPricing : membershipPricing;
  return (
    <section className="membership-plans" aria-label={t.plans}>
      <MembershipHero />
      <Tabs
        selectedKey={audience}
        onSelectionChange={(key) => setAudience(String(key))}
        className="membership-audiences"
      >
        <div className="membership-switcher">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t.audienceLabel}>
              {audiences.map((id) => (
                <Tabs.Tab key={id} id={id}>
                  {id === audience && (
                    <SelectionHighlight
                      layoutId="membership-audience-selection"
                      layoutDependency={audience}
                    />
                  )}
                  {t.audiences[id]}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {audience !== "enterprise" && (
            <ToggleButtonGroup
              aria-label={t.cycleLabel}
              data-cycle={cycle}
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
              {/* React Aria 构建页签集合时会把子元素渲染两遍，共享 motion layoutId 会交给隐藏副本；
                  这里改用一个常驻胶囊，以工具坞的弹簧曲线用 CSS 滑动。 */}
              <span className="membership-cycle-pill" aria-hidden="true" />
              {membershipCycles.map((item) => {
                const discount = lowestDiscount(audiencePlans, item.id);
                const hint = discount < 10 ? `${hintId}-${item.id}` : undefined;
                return (
                  <ToggleButton
                    id={item.id}
                    key={item.id}
                    aria-label={t.cycles[item.id]}
                    {...(hint ? { "aria-describedby": hint } : {})}
                  >
                    {t.cycles[item.id]}
                    {hint && (
                      <span id={hint} className="membership-cycle-hint">
                        {t.lowestDiscount(discount)}
                      </span>
                    )}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          )}
        </div>
        <div className="membership-panels">
          <Tabs.Panel id="personal">
            <MembershipPlanCards plans={membershipPricing} cycle={cycle} />
          </Tabs.Panel>
          <Tabs.Panel id="team">
            <MembershipPlanCards plans={teamMembershipPricing} cycle={cycle} team />
          </Tabs.Panel>
          <Tabs.Panel id="enterprise">
            <EnterpriseMembership />
          </Tabs.Panel>
        </div>
      </Tabs>
      <MembershipFaq />
    </section>
  );
}

function PlanQuotaSelect({
  plan,
  option,
  onSelect,
}: {
  plan: MembershipPlan;
  option: MembershipPlan["options"][number];
  onSelect: (credits: number) => void;
}) {
  const t = useMessages(membershipMessages);
  return (
    <div className="membership-quota-select">
      {plan.options.length > 1 ? (
        <ToggleButtonGroup
          aria-label={t.quotaTiers(plan.name)}
          size="sm"
          fullWidth
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[String(option.credits)]}
          onSelectionChange={(keys) => {
            const next = plan.options.find((item) => keys.has(String(item.credits)));
            if (next) onSelect(next.credits);
          }}
        >
          {plan.options.map((item, index) => (
            <ToggleButton
              key={item.credits}
              id={String(item.credits)}
              aria-label={t.quotaTier(plan.name, item.credits)}
            >
              {index > 0 && <ToggleButtonGroup.Separator />}
              <UiIcon icon={IconCoins} size="small" />
              {t.quotaPerMonth(item.label)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      ) : (
        <span>
          <UiIcon icon={IconCoins} size="small" />
          {t.quotaPerMonth(option.label)}
        </span>
      )}
    </div>
  );
}
