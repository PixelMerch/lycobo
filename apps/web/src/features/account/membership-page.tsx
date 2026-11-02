import { Button } from "@heroui/react";
import { IconArrowLeft, IconArrowUpRight, IconCrown } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseSession } from "../auth/auth-client";
import { CreditsDialog } from "./credits-dialog";
import { MembershipPlans } from "./membership-plans";
import "./membership-page.css";

export function MembershipPage() {
  const session = useEnterpriseSession();
  const [panel, setPanel] = useState<"recharge" | "billing" | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const returnTo =
    typeof state === "object" &&
    state !== null &&
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    /^\/(?:$|create(?:[/?]|$)|commerce(?:[/?]|$)|assets(?:[/?]|$))/.test(state.returnTo)
      ? state.returnTo
      : "/workspace";
  return (
    <div className="membership-page">
      <div className="membership-page-inner">
        <div className="membership-page-toolbar">
          <Button variant="ghost" size="sm" onPress={() => navigate(returnTo)}>
            <UiIcon icon={IconArrowLeft} />
            返回创作
          </Button>
          {session.data && (
            <Button variant="ghost" size="sm" onPress={() => setPanel("billing")}>
              积分明细
              <UiIcon icon={IconArrowUpRight} size="small" />
            </Button>
          )}
        </div>
        <header className="membership-page-heading">
          <span className="membership-page-eyebrow">
            <UiIcon icon={IconCrown} />
            LYCOBO 会员
          </span>
          <h1>让每次上新，都有更多可能</h1>
          <p>会员解锁专属能力，赠送积分用于创作。用量不够时，也可以单独补充。</p>
        </header>
        <MembershipPlans />
        <div className="membership-credit-link">
          <div>
            <h2>只想补充创作用量？</h2>
            <p>积分包可单独购买，无需改变会员等级。</p>
          </div>
          {session.data ? (
            <Button variant="secondary" size="sm" onPress={() => setPanel("recharge")}>
              查看积分包
              <UiIcon icon={IconArrowUpRight} size="small" />
            </Button>
          ) : (
            <span>登录后可查看积分余额与明细</span>
          )}
        </div>
        <p className="membership-page-note">
          会员正在筹备中，价格、赠送额度与专属权益以正式开放时公布的内容为准。
        </p>
      </div>
      {panel && <CreditsDialog initialView={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
