import { Tabs } from "@heroui/react";
import { IconCrown } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { CreditPacks } from "./credit-packs";
import { MembershipPlans } from "./membership-plans";
import type { MembershipTab } from "./membership-types";
import { useWallet } from "./wallet-client";
import { WalletPanel } from "./wallet-panel";
import "./membership-center.css";

export function MembershipCenter({ initialTab = "billing" }: { initialTab?: MembershipTab }) {
  const [tab, setTab] = useState<MembershipTab>(initialTab);
  return (
    <div className="membership-center">
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (key === "membership" || key === "credits" || key === "billing") setTab(key);
        }}
        variant="secondary"
        className="membership-tabs"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="会员与积分中心">
            <Tabs.Tab id="membership">
              会员方案
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="credits">
              积分充值
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="billing">
              账单明细
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="membership">
          <MembershipOverview />
          <MembershipPlans />
        </Tabs.Panel>
        <Tabs.Panel id="credits">
          <MembershipOverview />
          <CreditPacks />
        </Tabs.Panel>
        <Tabs.Panel id="billing">
          <WalletPanel
            onMembership={() => setTab("membership")}
            onRecharge={() => setTab("credits")}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function MembershipOverview() {
  const wallet = useWallet();
  return (
    <div className="membership-overview">
      <div className="membership-overview-status">
        <span className="membership-overview-icon">
          <UiIcon icon={IconCrown} size="action" />
        </span>
        <div>
          <strong>会员与创作积分</strong>
          <p>会员解锁专属功能，积分用于生成消耗。</p>
        </div>
        <span className="membership-coming">会员筹备中</span>
      </div>
      <div className="membership-overview-balance">
        <span>当前企业共享积分</span>
        <strong>
          <CreditCoin size="action" />
          {wallet.data?.balance?.toLocaleString("zh-CN") ?? "—"}
        </strong>
        <span>{wallet.isError ? "余额暂不可用，可在账单明细中重试" : "企业成员共同使用"}</span>
      </div>
    </div>
  );
}
