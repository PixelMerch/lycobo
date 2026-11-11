import { Button, Form, InputGroup, Label, Spinner, TextField, toast } from "@heroui/react";
import { type EnterpriseIdentity, emailCodeSendSchema } from "@lycoboai/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useEmailCodeLogin } from "./auth-client";
import { authMessages } from "./auth-messages";
import { useEmailTurnstile } from "./use-email-turnstile";

async function sendCode(email: string, captchaToken: string) {
  const t = currentMessages(authMessages);
  const response = await fetch("/api/v1/auth/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emailCodeSendSchema.parse({ email, captchaToken })),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error(t.emailSendFailed);
  });
  if (response.status === 429) throw new Error(t.emailRateLimited);
  if (response.status === 400) throw new Error(t.captchaFailed);
  if (!response.ok) throw new Error(t.emailSendFailed);
}

function useResendCooldown() {
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return {
    remaining,
    start: () => {
      setRemaining(60);
      setDeadline(Date.now() + 60000);
    },
  };
}

/** 在现有登录卡片内依次输入邮箱、完成人机验证并使用一次性验证码登录。 */
export function EmailLogin({
  siteKey,
  onLoginSuccess,
}: {
  siteKey: string | undefined;
  onLoginSuccess: (account: EnterpriseIdentity) => void;
}) {
  const t = useMessages(authMessages);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  // 发码要等人机验证和邮件服务，可能要好几秒；在发出前同步记下，连点或连按回车也只发一封。
  const sendingNow = useRef(false);
  const [error, setError] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  const verify = useEmailCodeLogin();
  const cooldown = useResendCooldown();
  const { container, challenge } = useEmailTurnstile(siteKey);
  const pending = sending || verify.isPending;
  // 主按钮只为自己的操作转圈：发码前是“发送验证码”，收到码后是“验证并登录”；重新发送在自己的按钮上转圈。
  const submitPending = sentEmail ? verify.isPending : sending;
  const inputReady = sentEmail ? code.length === 6 : Boolean(email.trim()) && !cooldown.remaining;
  useEffect(() => {
    if (sentEmail) codeInput.current?.focus({ preventScroll: true });
  }, [sentEmail]);

  async function send() {
    if (!siteKey || sendingNow.current || verify.isPending || cooldown.remaining) return;
    setError("");
    const address = email.trim().toLowerCase();
    if (!emailCodeSendSchema.shape.email.safeParse(address).success) {
      setError(t.emailInvalid);
      return;
    }
    sendingNow.current = true;
    setSending(true);
    try {
      const token = await challenge().catch(() => {
        throw new Error(t.captchaFailed);
      });
      await sendCode(address, token);
      setSentEmail(address);
      setCode("");
      cooldown.start();
      toast.success(t.codeSent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.emailSendFailed);
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!sentEmail) return send();
    if (code.length !== 6) return;
    setError("");
    try {
      const user = await verify.mutateAsync({ email: sentEmail, code });
      toast.success(t.signedIn);
      onLoginSuccess(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.serviceUnavailable);
      setCode("");
    } finally {
      verify.reset();
    }
  }

  return (
    <Form className="login-fields login-email" validationBehavior="aria" onSubmit={submit}>
      {sentEmail ? (
        <>
          <p className="login-email-recipient" role="status">
            {t.emailCodeSent(sentEmail)}
          </p>
          <TextField
            name="code"
            value={code}
            onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          >
            <Label className="visually-hidden">{t.emailCode}</Label>
            <InputGroup className="login-input-group">
              <InputGroup.Input
                ref={codeInput}
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder={t.emailCode}
              />
            </InputGroup>
          </TextField>
        </>
      ) : (
        <TextField
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          isDisabled={!siteKey || pending}
        >
          <Label className="visually-hidden">{t.email}</Label>
          <InputGroup className="login-input-group">
            <InputGroup.Input
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              maxLength={254}
            />
          </InputGroup>
        </TextField>
      )}
      <div ref={container} className="login-email-challenge" />
      <EmailSubmitButton
        codeStep={Boolean(sentEmail)}
        pending={submitPending}
        isDisabled={!siteKey || !inputReady || (Boolean(sentEmail) && sending)}
      />
      {sentEmail && (
        <EmailCodeActions
          sending={sending}
          verifying={verify.isPending}
          remaining={cooldown.remaining}
          onChangeEmail={() => {
            setSentEmail("");
            setCode("");
            setError("");
          }}
          onResend={() => void send()}
        />
      )}
      {error && (
        <p className="login-unavailable" role="alert">
          {error}
        </p>
      )}
    </Form>
  );
}

/** 主按钮：发码前是“发送验证码”，收到码后是“验证并登录”；进行中文字不变，前面转圈（同生成按钮）。 */
function EmailSubmitButton({
  codeStep,
  pending,
  isDisabled,
}: {
  codeStep: boolean;
  pending: boolean;
  isDisabled: boolean;
}) {
  const t = useMessages(authMessages);
  return (
    <Button
      type="submit"
      size="lg"
      className="login-email-submit"
      isDisabled={isDisabled}
      isPending={pending}
    >
      {pending && (
        <Spinner
          size="sm"
          color="current"
          role="status"
          aria-label={codeStep ? t.signingIn : t.sendingCode}
        />
      )}
      {codeStep ? t.emailVerify : t.sendCode}
    </Button>
  );
}

/** 收到验证码后的两个次要操作：更换邮箱与重新发送；重新发送时在按钮上转圈，免得用户以为没点到。 */
function EmailCodeActions({
  sending,
  verifying,
  remaining,
  onChangeEmail,
  onResend,
}: {
  sending: boolean;
  verifying: boolean;
  remaining: number;
  onChangeEmail: () => void;
  onResend: () => void;
}) {
  const t = useMessages(authMessages);
  return (
    <div className="login-email-actions">
      <Button variant="ghost" size="sm" isDisabled={sending || verifying} onPress={onChangeEmail}>
        {t.changeEmail}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        isDisabled={verifying || remaining > 0}
        isPending={sending}
        onPress={onResend}
      >
        {sending && <Spinner size="sm" color="current" role="status" aria-label={t.sendingCode} />}
        {remaining ? t.resendIn(remaining) : t.resendCode}
      </Button>
    </div>
  );
}
