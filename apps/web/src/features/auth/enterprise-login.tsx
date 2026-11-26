import {
  Button,
  FieldError,
  Form,
  InputGroup,
  Label,
  Spinner,
  TextField,
  ToggleButton,
} from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconArrowLeft, IconArrowRight, IconEye, IconEyeOff } from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { toast } from "../../lib/toast";
import { AccountLockedError, LoginVerificationError, useEnterpriseLogin } from "./auth-client";
import { authMessages } from "./auth-messages";
import { useLoginAvailability } from "./social-login-client";
import { useLoginTurnstile } from "./use-login-turnstile";

/** 企业账号表单先完成人机验证，并在表单内展示密码锁定提示。 */
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
        <div ref={form.challengeContainer} className="login-challenge" />
        {form.verificationError && (
          <p className="login-lock-notice" role="alert">
            {form.verificationError}
          </p>
        )}
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="login-submit"
          isPending={form.pending}
          isDisabled={!form.siteKey}
        >
          {t.signIn}
          {form.pending ? (
            <Spinner size="sm" color="current" role="status" aria-label={t.signingIn} />
          ) : (
            <UiIcon icon={IconArrowRight} />
          )}
        </Button>
        {form.lockNotice && (
          <p className="login-lock-notice" role="alert">
            {form.lockNotice}
          </p>
        )}
        {form.unavailable && (
          <p className="login-unavailable" role="status">
            {t.serviceUnavailable}
          </p>
        )}
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
  const availability = useLoginAvailability();
  const siteKey = availability.data?.passwordTurnstileSiteKey;
  const { container, challenge, closeChallenge } = useLoginTurnstile(siteKey, "password_login");
  const submitting = useRef(false);
  const [checking, setChecking] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const accountInput = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [lockNotice, setLockNotice] = useState("");
  const [verificationError, setVerificationError] = useState("");
  useErrorToast(error);
  const pending = checking || login.isPending;
  useEffect(() => {
    accountInput.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    // 失败后等字段解除禁用再恢复焦点，避免聚焦仍被禁用的密码框。
    if (error && !pending) passwordInput.current?.focus();
  }, [error, pending]);
  function reportFailure(cause: unknown) {
    if (cause instanceof AccountLockedError) {
      setLockNotice(cause.message);
      return;
    }
    setLockNotice("");
    setError(
      cause instanceof Error ? cause.message : currentMessages(authMessages).serviceUnavailable,
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !siteKey) return;
    setError("");
    setVerificationError("");
    setSubmitted(true);
    if (!account.trim() || !password) return;
    setSubmitted(false);
    const credentials = { account: account.trim(), password };
    submitting.current = true;
    setChecking(true);
    setVisible(false);
    try {
      const captchaToken = await challenge().catch(() => {
        throw new LoginVerificationError(currentMessages(authMessages).captchaFailed);
      });
      const user = await login.mutateAsync({ ...credentials, captchaToken });
      setPassword("");
      toast.success(currentMessages(authMessages).signedIn);
      onLoginSuccess(user);
    } catch (cause) {
      if (cause instanceof LoginVerificationError) {
        setLockNotice("");
        setVerificationError(cause.message);
      } else {
        setPassword("");
        reportFailure(cause);
      }
    } finally {
      closeChallenge();
      setChecking(false);
      submitting.current = false;
      login.reset();
    }
  }
  return {
    account,
    setAccount: (value: string) => {
      if (value.trim().toLowerCase() !== account.trim().toLowerCase()) setLockNotice("");
      setAccount(value);
    },
    password,
    setPassword,
    visible,
    setVisible,
    submitted,
    accountInput,
    passwordInput,
    setError,
    submit,
    pending,
    siteKey,
    unavailable: !availability.isPending && !siteKey,
    lockNotice,
    verificationError,
    challengeContainer: container,
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
