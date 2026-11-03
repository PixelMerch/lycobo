import { Button, Card, Tooltip } from "@heroui/react";
import {
  IconCheck,
  IconCoins,
  IconInfoCircle,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { UiIcon } from "../../components/ui-icon";

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

export function MembershipBenefits({ team }: { team: boolean }) {
  const items = team
    ? ["管理员管理成员账户", "成员共用组织积分", "组织消费与任务记录"]
    : ["商品主图与场景创作", "家纺多视角与细节图", "套图计划与批量生成"];
  return (
    <div className="membership-benefits">
      <h3>
        <span>
          {team ? "团队协作" : "创作工具"}
          <MembershipInfo label={team ? "团队协作说明" : "创作工具说明"}>
            {team
              ? "成员使用独立账户登录，组织权限由管理员管理；积分归属和消费按所在组织记录。"
              : "支持主图制作、家纺裂变和套图计划；实际可用模型与单次消耗以创作面板显示为准。"}
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

export function EnterpriseMembership() {
  return (
    <section className="membership-enterprise" aria-label="企业服务">
      <h2>企业协作</h2>
      <div className="membership-enterprise-grid">
        {[
          { icon: IconUsers, title: "账户管理", text: "管理员统一管理成员账户，成员独立登录。" },
          { icon: IconCoins, title: "共享积分", text: "团队共享创作用量，集中查看消费记录。" },
          { icon: IconShieldCheck, title: "权限分工", text: "按组织与成员身份管理业务访问。" },
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
        联系顾问
      </Button>
    </section>
  );
}
