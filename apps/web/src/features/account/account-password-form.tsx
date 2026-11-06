import { Button, Description, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterprisePasswordChange } from "../auth/auth-client";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

export function AccountPasswordForm() {
  const change = useEnterprisePasswordChange();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const invalidNewPassword = newPassword.length < 12 || newPassword.length > 256;
  useErrorToast(change.error?.message);
  return (
    <div className="account-settings-section">
      <SettingsGroup title="第三方账号">
        <SettingsRow
          label="微信"
          hint="微信登录绑定暂未开放"
          value={<span className="settings-status">未绑定</span>}
          action={
            <Button size="sm" variant="secondary" isDisabled>
              绑定微信
            </Button>
          }
        />
      </SettingsGroup>
      <SettingsGroup title="修改密码" description="修改后所有设备需要重新登录。">
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
            <Label>当前密码</Label>
            <Input autoComplete="current-password" />
            <FieldError>请输入当前密码</FieldError>
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
            <Label>新密码</Label>
            <Input autoComplete="new-password" />
            <Description>12 至 256 个字符</Description>
            <FieldError>新密码需为 12 至 256 个字符</FieldError>
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
            <Label>确认新密码</Label>
            <Input autoComplete="new-password" />
            <FieldError>两次输入的新密码不一致</FieldError>
          </TextField>
          <div className="account-password-actions">
            <Button type="submit" size="sm" variant="primary" isPending={change.isPending}>
              保存新密码
            </Button>
          </div>
        </Form>
      </SettingsGroup>
    </div>
  );
}
