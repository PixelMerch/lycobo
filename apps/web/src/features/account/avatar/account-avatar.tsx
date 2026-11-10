import { Avatar } from "@heroui/react";
import { type AvatarPreset, avatarPresetIds, type EnterpriseIdentity } from "@lycoboai/contracts";
import "./account-avatar.css";

/** 没选过或认不出的预设（例如新部署新增的 id）显示默认的青柠头像。 */
export function avatarPresetOf(value: string | null | undefined): AvatarPreset {
  return avatarPresetIds.find((id) => id === value) ?? "lime";
}

/** 头像里显示的账号首字母（大写）。 */
export function accountInitial(account: string) {
  return Array.from(account)[0]?.toUpperCase() ?? "";
}

/** 账户头像：按用户选择的预设渐变显示首字母，顶部栏、账户菜单与设置共用同一份配色。 */
export function AccountAvatar({
  account,
  size,
  className,
}: {
  account: EnterpriseIdentity;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      className={className}
      data-avatar-preset={avatarPresetOf(account.avatarPreset)}
      aria-hidden="true"
    >
      <Avatar.Fallback>{accountInitial(account.account)}</Avatar.Fallback>
    </Avatar>
  );
}
