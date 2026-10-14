import { Button, Popover } from "@heroui/react";
import { IconCoins, IconCrown, IconPhoto, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { UiIcon } from "../../components/ui-icon";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button variant="tertiary" className="account-trigger" aria-label="个人账户">
        <UiIcon icon={IconCoins} size="default" />
        <span>—</span>
        <span className="plan-tag">访客</span>
        <span className="account-avatar">
          <UiIcon icon={IconUser} size="default" />
        </span>
      </Button>
      <Popover.Content placement="bottom end" className="account-popover">
        <Popover.Dialog aria-label="个人账户" className="account-dialog">
          <div className="account-identity">
            <span className="account-avatar large">
              <UiIcon icon={IconUser} size="illustration" />
            </span>
            <div>
              <Popover.Heading>未登录</Popover.Heading>
              <p>登录后管理你的作品</p>
            </div>
            <span className="plan-tag">访客</span>
          </div>
          <div className="account-balance">
            <span>
              <UiIcon icon={IconCoins} size="default" />
              可用积分
            </span>
            <strong>—</strong>
          </div>
          <div className="account-upgrade">
            <Button isDisabled>
              <UiIcon icon={IconCrown} size="default" />
              订阅会员
            </Button>
            <Button variant="secondary" isDisabled>
              购买积分
            </Button>
          </div>
          <p className="account-note">会员与充值暂未开放</p>
          <Link className="account-link" to="/assets" onClick={() => setOpen(false)}>
            <UiIcon icon={IconPhoto} size="default" />
            我的作品
          </Link>
          <div className="account-unavailable">
            <span>订阅与账单</span>
            <small>暂未开放</small>
          </div>
          <div className="account-unavailable">
            <span>账号管理</span>
            <small>登录后可用</small>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
