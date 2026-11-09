import { Button, Description, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterprisePasswordChange } from "../../auth/auth-client";
import { accountSettingsMessages } from "./account-settings-messages";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

/** 登录与安全面板：第三方账号绑定（尚未开放）与修改密码。 */
export function AccountPasswordForm() {
  const t = useMessages(accountSettingsMessages);
  const change = useEnterprisePasswordChange();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const invalidNewPassword = newPassword.length < 12 || newPassword.length > 256;
  useErrorToast(change.error?.message);
  return (
    <div className="account-settings-section">
      <SettingsGroup title={t.thirdParty}>
        <SettingsRow
          label={t.wechat}
          hint={t.wechatUnavailable}
          value={<span className="settings-status">{t.notBound}</span>}
          action={
            <Button size="sm" variant="secondary" isDisabled>
              {t.bindWechat}
            </Button>
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t.changePassword} description={t.changePasswordHint}>
        <Form
          className="account-password-form"
          validationBehavior="aria"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (
              change.isPending ||
              !currentPassword ||
              invalidNewPassword ||
              newPassword !== confirmation
            )
              return;
            change.mutate({ currentPassword, newPassword });
          }}
        >
          <TextField
            className="account-field"
            name="currentPassword"
            type="password"
            isRequired
            maxLength={256}
            isInvalid={submitted && !currentPassword}
            value={currentPassword}
            onChange={setCurrentPassword}
            isDisabled={change.isPending}
          >
            <Label>{t.currentPassword}</Label>
            <Input autoComplete="current-password" />
            <FieldError>{t.currentPasswordRequired}</FieldError>
          </TextField>
          <TextField
            className="account-field"
            name="newPassword"
            type="password"
            isRequired
            minLength={12}
            maxLength={256}
            isInvalid={submitted && invalidNewPassword}
            value={newPassword}
            onChange={setNewPassword}
            isDisabled={change.isPending}
          >
            <Label>{t.newPassword}</Label>
            <Input autoComplete="new-password" />
            <Description>{t.passwordLength}</Description>
            <FieldError>{t.passwordLengthError}</FieldError>
          </TextField>
          <TextField
            className="account-field"
            name="confirmation"
            type="password"
            isRequired
            maxLength={256}
            value={confirmation}
            onChange={setConfirmation}
            isDisabled={change.isPending}
            isInvalid={submitted && (!confirmation || confirmation !== newPassword)}
          >
            <Label>{t.confirmPassword}</Label>
            <Input autoComplete="new-password" />
            <FieldError>{t.passwordMismatch}</FieldError>
          </TextField>
          <div className="account-password-actions">
            <Button type="submit" size="sm" variant="primary" isPending={change.isPending}>
              {t.savePassword}
            </Button>
          </div>
        </Form>
      </SettingsGroup>
    </div>
  );
}
