import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { avatarPresetIds, type EnterpriseIdentity } from "@lycoboai/contracts";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseAvatar } from "../../auth/auth-client";
import { accountInitial, avatarPresetOf } from "../avatar/account-avatar";
import { accountSettingsMessages } from "./account-settings-messages";

/** 头像只能从预设中选择：点选后立即保存到账号，保存中显示新选择，失败时提示并退回原头像。 */
export function AvatarPresetPicker({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountSettingsMessages);
  const save = useEnterpriseAvatar();
  useErrorToast(save.error?.message);
  const current = avatarPresetOf(account.avatarPreset);
  const shown = save.isPending && save.variables ? save.variables : current;
  const initial = accountInitial(account.account);
  return (
    <ToggleButtonGroup
      aria-label={t.avatar}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[shown]}
      isDisabled={save.isPending}
      onSelectionChange={(keys) => {
        const next = avatarPresetIds.find((id) => keys.has(id));
        if (next && next !== current) save.mutate(next);
      }}
      className="avatar-preset-picker"
    >
      {avatarPresetIds.map((id) => (
        <ToggleButton
          key={id}
          id={id}
          isIconOnly
          aria-label={t.avatarPreset(t.presetNames[id])}
          className="avatar-preset-option"
        >
          <span className="avatar-preset-swatch" data-avatar-preset={id} aria-hidden="true">
            {initial}
          </span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
