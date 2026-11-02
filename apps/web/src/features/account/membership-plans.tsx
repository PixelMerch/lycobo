import { Button, Card, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck, IconCrown, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";

// Presentation proposals only. Commercial terms and entitlements are not configured.
const plans = [
  {
    id: "creator",
    name: "创作会员",
    description: "为日常商品图创作，补足能力与用量。",
    features: ["开通会员赠送积分", "使用对应档位的会员专属功能", "按需单独补充积分"],
  },
  {
    id: "professional",
    name: "专业会员",
    description: "为更高频的商品创作，提供进阶选择。",
    features: ["配套更高档位的赠送积分", "使用对应档位的进阶会员权益", "按需单独补充积分"],
  },
] as const;

export function MembershipPlans() {
  const [cycle, setCycle] = useState("monthly");
  return (
    <section className="membership-plans" aria-label="会员方案">
      <div className="membership-section-heading">
        <div>
          <h3>选择你的会员方案</h3>
          <p>两种创作节奏，按需选择。</p>
        </div>
        <ToggleButtonGroup
          aria-label="会员周期"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[cycle]}
          onSelectionChange={(keys) => {
            if (keys.has("monthly")) setCycle("monthly");
            else if (keys.has("yearly")) setCycle("yearly");
          }}
          className="membership-cycle"
          size="sm"
        >
          <ToggleButton id="monthly">月度</ToggleButton>
          <ToggleButton id="yearly">年度</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div className="membership-plan-grid">
        {plans.map((plan) => (
          <Card key={plan.id} className="membership-plan" data-plan={plan.id}>
            <Card.Header>
              <span className="membership-plan-symbol">
                <UiIcon icon={plan.id === "creator" ? IconCrown : IconSparkles} size="action" />
              </span>
              <Card.Title>{plan.name}</Card.Title>
              <Card.Description>{plan.description}</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="membership-plan-price">
                <strong>价格待公布</strong>
                <span>{cycle === "monthly" ? "按月订阅" : "按年订阅"}</span>
              </div>
              <div className="membership-plan-gift">
                <CreditCoin size="default" />
                <span>开通赠送积分</span>
                <span>额度待公布</span>
              </div>
              <ul className="membership-feature-list">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <UiIcon icon={IconCheck} size="small" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </Card.Content>
            <Card.Footer>
              <Button
                variant={plan.id === "professional" ? "primary" : "secondary"}
                isDisabled
                className="membership-plan-action"
                aria-label={`${plan.name}即将开放`}
              >
                会员即将开放
              </Button>
              <p className="membership-plan-terms">专属权益与赠送额度待公布</p>
            </Card.Footer>
          </Card>
        ))}
      </div>
    </section>
  );
}
