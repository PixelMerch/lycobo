import { Avatar, Button, Chip } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconCopy } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { copyToClipboard } from "../../../lib/clipboard";
import { roleLabel } from "../account-format";

/** Compact account identity shared by billing and personal settings. */
export function AccountProfile({ account }: { account: EnterpriseIdentity }) {
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  return (
    <section className="account-profile-card" aria-label="账号信息">
      <Avatar className="account-profile-avatar" aria-hidden="true">
        <Avatar.Fallback>{initial}</Avatar.Fallback>
      </Avatar>
      <div className="account-profile-main">
        <strong title={account.account}>{account.account}</strong>
        <div className="account-profile-meta">
          <Chip size="sm" className="account-chip">
            {roleLabel(account.role)}
          </Chip>
          <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
          {account.uid && (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="复制 UID"
              className="account-copy"
              onPress={() => {
                if (account.uid) void copyToClipboard(account.uid, "UID 已复制");
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
