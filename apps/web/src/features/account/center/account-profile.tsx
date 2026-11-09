import { Avatar, Button, Chip } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconCopy } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { roleLabel } from "../account-format";
import { accountCenterMessages } from "./account-center-messages";

/** 积分与账单顶部的紧凑账号信息：头像、账号、角色与可复制的 UID。 */
export function AccountProfile({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountCenterMessages);
  const locale = useLocale();
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  return (
    <section className="account-profile-card" aria-label={t.accountInfo}>
      <Avatar className="account-profile-avatar" aria-hidden="true">
        <Avatar.Fallback>{initial}</Avatar.Fallback>
      </Avatar>
      <div className="account-profile-main">
        <strong title={account.account}>{account.account}</strong>
        <div className="account-profile-meta">
          <Chip size="sm" className="account-chip">
            {roleLabel(account.role, locale)}
          </Chip>
          <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
          {account.uid && (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t.copyUid}
              className="account-copy"
              onPress={() => {
                if (account.uid) void copyToClipboard(account.uid, t.uidCopied);
              }}
            >
              <UiIcon icon={IconCopy} size="small" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
