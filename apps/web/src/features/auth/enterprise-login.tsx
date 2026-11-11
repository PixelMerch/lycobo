import {
  Button,
  FieldError,
  Form,
  InputGroup,
  Label,
  Spinner,
  TextField,
  ToggleButton,
  toast,
} from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconArrowLeft, IconArrowRight, IconEye, IconEyeOff } from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogin } from "./auth-client";
import { authMessages } from "./auth-messages";

/** 企业登录独占卡片背面，沿用原有认证与会话刷新。 */
export function EnterpriseLogin({
  onLoginSuccess,
  onBack,
}: {
  onLoginSuccess: (account: EnterpriseIdentity) => void;
  onBack: () => void;
}) {
  const form = useEnterpriseForm(onLoginSuccess);
  const t = useMessages(authMessages);
  return (
    <div className="login-enterprise">
      <Form className="login-fields" validationBehavior="aria" onSubmit={form.submit}>
        <EnterpriseFields form={form} />
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="login-submit"
          isPending={form.pending}
        >
          {t.signIn}
          {form.pending ? (
            <Spinner size="sm" color="current" role="status" aria-label={t.signingIn} />
          ) : (
            <UiIcon icon={IconArrowRight} />
          )}
        </Button>
      </Form>
      <Button
        variant="ghost"
        size="lg"
        className="login-back"
        isDisabled={form.pending}
        onPress={onBack}
      >
        <UiIcon icon={IconArrowLeft} />
        {t.back}
      </Button>
    </div>
  );
}

function useEnterpriseForm(onLoginSuccess: (account: EnterpriseIdentity) => void) {
  const login = useEnterpriseLogin();
  const passwordInput = useRef<HTMLInputElement>(null);
  const accountInput = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);
  useEffect(() => {
    accountInput.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    // 失败后等字段解除禁用再恢复焦点，避免聚焦仍被禁用的密码框。
    if (error && !login.isPending) passwordInput.current?.focus();
  }, [error, login.isPending]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (login.isPending) return;
    setError("");
    setSubmitted(true);
    if (!account.trim() || !password) return;
    setSubmitted(false);
    const credentials = { account: account.trim(), password };
    setPassword("");
    setVisible(false);
    try {
      const user = await login.mutateAsync(credentials);
      toast.success(currentMessages(authMessages).signedIn);
      onLoginSuccess(user);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : currentMessages(authMessages).serviceUnavailable,
      );
    } finally {
      login.reset();
    }
  }
  return {
    account,
    setAccount,
    password,
    setPassword,
    visible,
    setVisible,
    submitted,
    accountInput,
    passwordInput,
    setError,
    submit,
    pending: login.isPending,
  };
}

function EnterpriseFields({ form }: { form: ReturnType<typeof useEnterpriseForm> }) {
  const t = useMessages(authMessages);
  return (
    <>
      <TextField
        name="account"
        value={form.account}
        onChange={(value) => {
          form.setAccount(value);
          form.setError("");
        }}
        isRequired
        isDisabled={form.pending}
        isInvalid={form.submitted && !form.account.trim()}
      >
        <Label>{t.account}</Label>
        <InputGroup className="login-input-group">
          <InputGroup.Input
            ref={form.accountInput}
            autoComplete="username"
            placeholder={t.accountPlaceholder}
            maxLength={128}
          />
        </InputGroup>
        <FieldError>{t.accountPlaceholder}</FieldError>
      </TextField>
      <TextField
        name="password"
        value={form.password}
        onChange={(value) => {
          form.setPassword(value);
          form.setError("");
        }}
        type={form.visible ? "text" : "password"}
        isRequired
        isDisabled={form.pending}
        isInvalid={form.submitted && !form.password}
      >
        <Label>{t.password}</Label>
        <InputGroup className="login-input-group">
          <InputGroup.Input
            ref={form.passwordInput}
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            maxLength={256}
          />
          <InputGroup.Suffix>
            <ToggleButton
              isIconOnly
              size="lg"
              variant="ghost"
              isSelected={form.visible}
              isDisabled={form.pending}
              aria-label={form.visible ? t.hidePassword : t.showPassword}
              onChange={form.setVisible}
            >
              <UiIcon icon={form.visible ? IconEyeOff : IconEye} />
            </ToggleButton>
          </InputGroup.Suffix>
        </InputGroup>
        <FieldError>{t.passwordPlaceholder}</FieldError>
      </TextField>
    </>
  );
}
