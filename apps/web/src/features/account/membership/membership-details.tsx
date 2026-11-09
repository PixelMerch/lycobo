import { Button, Card, Tooltip } from "@heroui/react";
import {
  IconCheck,
  IconCoins,
  IconInfoCircle,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { membershipMessages } from "./membership-messages";

/** 方案卡里的说明图标：悬停或聚焦时用提示气泡展开补充说明。 */
export function MembershipInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delay={150}>
      <Button isIconOnly size="sm" variant="ghost" aria-label={label} className="membership-info">
        <UiIcon icon={IconInfoCircle} size="small" />
      </Button>
      <Tooltip.Content className="membership-tooltip" placement="top">
        <Tooltip.Arrow />
        {children}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** 方案卡底部的权益清单：团队方案列协作权益，个人方案列创作工具。 */
export function MembershipBenefits({ team }: { team: boolean }) {
  const t = useMessages(membershipMessages);
  const items = team ? t.teamBenefits : t.toolBenefits;
  return (
    <div className="membership-benefits">
      <h3>
        <span>
          {team ? t.teamwork : t.tools}
          <MembershipInfo label={team ? t.teamworkInfo : t.toolsInfo}>
            {team ? t.teamworkNote : t.toolsNote}
          </MembershipInfo>
        </span>
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <UiIcon icon={IconCheck} size="small" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 企业页签：企业协作能力说明，联系顾问入口尚未开放。 */
export function EnterpriseMembership() {
  const t = useMessages(membershipMessages);
  return (
    <section className="membership-enterprise" aria-label={t.enterpriseService}>
      <h2>{t.enterpriseTitle}</h2>
      <div className="membership-enterprise-grid">
        {[
          { icon: IconUsers, ...t.enterpriseItems.accounts },
          { icon: IconCoins, ...t.enterpriseItems.credits },
          { icon: IconShieldCheck, ...t.enterpriseItems.access },
        ].map((item) => (
          <Card key={item.title}>
            <Card.Header>
              <UiIcon icon={item.icon} size="action" />
              <Card.Title>{item.title}</Card.Title>
            </Card.Header>
            <Card.Content>{item.text}</Card.Content>
          </Card>
        ))}
      </div>
      <Button variant="primary" isDisabled className="membership-enterprise-contact">
        {t.contact}
      </Button>
    </section>
  );
}
