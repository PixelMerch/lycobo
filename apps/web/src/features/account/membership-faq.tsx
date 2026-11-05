import { Accordion } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";

const questions = [
  {
    id: "credits",
    title: "什么是积分，在哪里查看余额？",
    body: "积分用于图片生成与编辑等创作消耗。顶部积分入口可查看余额与最近记录，积分与账单的积分明细可查看完整收支。",
  },
  {
    id: "billing",
    title: "创作时如何扣除积分？",
    body: "每次生成前，创作按钮会显示本次所需积分。费用取决于所选模型、生成数量及参数；提交后以该任务记录的实际扣费为准。",
  },
  {
    id: "refund",
    title: "生成失败后，积分会退回吗？",
    body: "任务确定失败后，对应积分会退回原钱包。多张图片部分失败时，只退回失败部分；结果仍在核对中的任务，请先查看任务状态和收支明细。",
  },
  {
    id: "cycle",
    title: "月付、季付和年付有什么区别？",
    body: "三种方案对应不同的订阅周期与总价。套餐卡片同时列出周期价格、每月积分额度和折算月价，切换周期后可直接比较。",
  },
  {
    id: "membership",
    title: "购买积分和订阅会员有什么区别？",
    body: "积分补充创作用量，会员方案用于选择订阅周期与套餐权益。单独购买积分不改变会员等级，积分也不用于兑换会员身份。",
  },
  {
    id: "team",
    title: "团队成员如何使用账户和积分？",
    body: "管理员管理组织成员账户，成员分别登录。组织成员共用所在组织的钱包，消费记录保留操作账户与任务信息，不同组织的数据互相隔离。",
  },
  {
    id: "seats",
    title: "团队套餐的席位和价格如何计算？",
    body: "团队卡片按每席展示周期价格与每月积分额度。调整席位后可查看本周期合计金额；请按实际协作人数选择席位，成员使用各自的账户登录。",
  },
  {
    id: "renewal",
    title: "如何确认自动续费与订单退款规则？",
    body: "支付前请核对订单中的订阅周期、续费选项和退款条款。购买订单退款与图片任务失败退回积分属于不同记录，核对时请保留对应订单或任务编号。",
  },
] as const;

export function MembershipFaq() {
  return (
    <section className="membership-faq" aria-labelledby="membership-faq-heading">
      <h2 id="membership-faq-heading">订阅与积分常见问题</h2>
      <Accordion allowsMultipleExpanded>
        {questions.map((item) => (
          <Accordion.Item id={item.id} key={item.id}>
            <Accordion.Heading>
              <Accordion.Trigger>
                {item.title}
                <Accordion.Indicator>
                  <span>
                    <UiIcon icon={IconChevronDown} size="default" />
                  </span>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>{item.body}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </section>
  );
}
