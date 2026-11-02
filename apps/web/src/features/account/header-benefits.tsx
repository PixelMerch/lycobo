import { Button, Tooltip } from "@heroui/react";
import { IconChevronRight, IconCrown } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { AccountPanel } from "./account-panel";
import type { MembershipTab } from "./membership-types";
import { useWallet } from "./wallet-client";
import "./membership-center.css";

/** Mounted only for signed-in users; the wallet query is shared with the account menu. */
export function HeaderBenefits() {
  const wallet = useWallet();
  const [section, setSection] = useState<MembershipTab | null>(null);
  const balance = wallet.data?.balance;
  const balanceLabel = balance === undefined ? "—" : balance.toLocaleString("zh-CN");
  return (
    <>
      <div className="header-benefits">
        <Tooltip delay={300}>
          <Button
            variant="secondary"
            size="sm"
            className="header-balance"
            aria-label={`企业共享积分 ${balanceLabel}，查看账单明细`}
            onPress={() => setSection("billing")}
          >
            <CreditCoin size="default" />
            <span className="header-balance-value">{balanceLabel}</span>
            <span className="header-balance-unit">积分</span>
          </Button>
          <Tooltip.Content>
            {wallet.isError ? "余额暂不可用，点击查看账单" : "企业成员共享 · 查看账单明细"}
          </Tooltip.Content>
        </Tooltip>
        <Button
          variant="secondary"
          size="sm"
          className="header-membership"
          onPress={() => setSection("membership")}
        >
          <UiIcon icon={IconCrown} />
          会员中心
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
      {section && (
        <AccountPanel
          section="credits"
          initialMembershipTab={section}
          onClose={() => setSection(null)}
        />
      )}
    </>
  );
}
