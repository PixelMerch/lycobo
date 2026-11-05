import {
  Button,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Modal,
  TextField,
  ToggleButton,
} from "@heroui/react";
import { IconBrandWechat, IconEye, IconEyeOff, IconQrcode, IconX } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type FormEvent, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { photo } from "../generation/studio-state";
import { useEnterpriseLogin } from "./auth-client";

type LoginMode = "wechat" | "phone" | "enterprise";
const loginMethods: { mode: LoginMode; label: string; hint: string }[] = [
  { mode: "phone", label: "手机号", hint: "使用手机号和验证码登录" },
  { mode: "enterprise", label: "企业账号", hint: "使用企业账号和密码登录" },
  { mode: "wechat", label: "微信扫码", hint: "使用微信扫码登录创作工作台" },
];

export function LoginDialog({
  onClose,
  onLoginSuccess = onClose,
}: {
  onClose: () => void;
  onLoginSuccess?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<"open" | "closed">("open");
  const form = useLoginForm(onLoginSuccess);
  const { mode, hint, switchMode } = form;
  // Closing is animated first; the modal unmounts once the panel settles.
  const requestClose = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    setPhase("closed");
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className={`login-backdrop${phase === "closed" ? " is-closing" : ""}`}>
        <Modal.Container className="login-container">
          <Modal.Dialog className="login-dialog">
            <motion.div
              className="login-panel"
              initial={reduceMotion ? false : "closed"}
              animate={phase}
              variants={{
                // Entry settles with a soft spring; exit is a short tween so the
                // dismissal never feels slower than the open.
                open: {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 320, damping: 30, mass: 0.9 },
                },
                closed: {
                  opacity: 0,
                  scale: 0.98,
                  y: 6,
                  transition: { duration: 0.14, ease: [0.3, 0, 0.7, 1] },
                },
              }}
              onAnimationComplete={() => {
                if (phase === "closed") onClose();
              }}
            >
              {/* Inside the panel so the close control leaves with everything else. */}
              <Modal.CloseTrigger className="login-close" aria-label="关闭登录">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
              <div className="login-split">
                <section className="login-visual" aria-label="创作案例预览">
                  <img src={photo("bedroom")} alt="" width="880" height="1200" loading="eager" />
                  <div className="login-visual-copy">
                    <span className="login-kicker">LYCOBO · 创作工作台</span>
                    <h2>
                      让家纺商品，
                      <br />
                      拥有新的画面。
                    </h2>
                    <p>参考图重绘、换色换花型与场景合成，都在同一处完成。</p>
                  </div>
                </section>
                <div className="login-content">
                  <Modal.Header className="login-header">
                    <span className="login-brand-mark" aria-hidden="true">
                      <img
                        src="/brand/lycobo-product-pilot-mark.svg"
                        alt=""
                        width="24"
                        height="18"
                      />
                    </span>
                    <Modal.Heading>欢迎使用 Lycobo</Modal.Heading>
                    <p>{hint}</p>
                  </Modal.Header>
                  <Modal.Body className="login-body">
                    <div className="login-form">
                      <LoginFields form={form} />
                    </div>
                    <div className="login-alternative">
                      <span className="login-divider">或</span>
                      <div className="login-secondary-methods">
                        {loginMethods
                          .filter((method) => method.mode !== mode)
                          .map((method) => (
                            <Button
                              key={method.mode}
                              variant="ghost"
                              className="login-other"
                              onPress={() => switchMode(method.mode)}
                            >
                              {method.mode === "wechat" && (
                                <UiIcon icon={IconBrandWechat} size="small" />
                              )}
                              {method.mode === "wechat"
                                ? "通过微信扫码登录"
                                : `${method.label}登录`}
                            </Button>
                          ))}
                      </div>
                    </div>
                    <p className="login-support">账号问题请联系管理员</p>
                  </Modal.Body>
                </div>
              </div>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function useLoginForm(onLoginSuccess: () => void) {
  const login = useEnterpriseLogin();
  const passwordInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<LoginMode>("enterprise");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);
  const phoneValid = /^1[3-9]\d{9}$/.test(phone);
  const hint = loginMethods.find((method) => method.mode === mode)?.hint;
  const switchMode = (next: LoginMode) => {
    if (next === mode) return;
    setMode(next);
    setSubmitted(false);
    setError("");
    setPassword("");
    setCode("");
    setVisible(false);
  };

  function submitPhone() {
    if (!phoneValid || !/^\d{6}$/.test(code)) return;
    setError("手机号登录服务暂未开放，请稍后再试。");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (login.isPending) return;
    setError("");
    setSubmitted(true);
    if (mode !== "enterprise") {
      submitPhone();

      return;
    }
    if (!account.trim() || !password) return;
    setSubmitted(false);
    const credentials = { account: account.trim(), password };
    setPassword("");
    try {
      await login.mutateAsync(credentials);
      onLoginSuccess();
    } catch (cause) {
      passwordInput.current?.focus();
      setError(cause instanceof Error ? cause.message : "登录服务暂时不可用，请稍后重试。");
    } finally {
      login.reset();
    }
  }
  return {
    mode,
    hint,
    switchMode,
    submit,
    pending: login.isPending,
    passwordInput,
    account,
    setAccount,
    password,
    setPassword,
    phone,
    setPhone,
    code,
    setCode,
    visible,
    setVisible,
    submitted,
    setSubmitted,
    phoneValid,
    setError,
  };
}

type LoginForm = ReturnType<typeof useLoginForm>;

function LoginFields({ form }: { form: LoginForm }) {
  const { mode, pending } = form;
  if (mode === "wechat")
    return (
      <div className="login-wechat">
        <div className="login-qr-unavailable" role="status" aria-label="扫码登录暂未开放">
          <UiIcon icon={IconQrcode} size="illustration" />
          <span>扫码登录暂未开放</span>
        </div>
        <p className="login-wechat-copy">
          请使用微信扫描公众号二维码登录。扫码服务暂未开放，请稍后再试。
        </p>
      </div>
    );
  return (
    <Form key={mode} className="login-fields" validationBehavior="aria" onSubmit={form.submit}>
      {mode === "enterprise" ? <EnterpriseFields form={form} /> : <PhoneFields form={form} />}
      <Button type="submit" className="login-submit" isPending={pending}>
        {pending ? "登录中…" : "登录"}
      </Button>
    </Form>
  );
}

function EnterpriseFields({ form }: { form: LoginForm }) {
  const {
    account,
    setAccount,
    password,
    setPassword,
    setError,
    visible,
    setVisible,
    passwordInput,
    submitted,
  } = form;
  return (
    <>
      <TextField
        name="account"
        value={account}
        onChange={(value) => {
          setAccount(value);
          setError("");
        }}
        isRequired
        isInvalid={submitted && !account.trim()}
      >
        <Label>企业账号</Label>
        <Input autoFocus autoComplete="username" placeholder="请输入企业账号" maxLength={128} />
        <FieldError>请输入企业账号</FieldError>
      </TextField>
      <TextField
        name="password"
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError("");
        }}
        type={visible ? "text" : "password"}
        isRequired
        isInvalid={submitted && !password}
      >
        <Label>密码</Label>
        <InputGroup className="login-input-group">
          <InputGroup.Input
            ref={passwordInput}
            autoComplete="current-password"
            placeholder="请输入密码"
            maxLength={256}
          />
          <InputGroup.Suffix>
            <ToggleButton
              isIconOnly
              isSelected={visible}
              variant="ghost"
              aria-label={visible ? "隐藏密码" : "显示密码"}
              onChange={setVisible}
            >
              <UiIcon icon={visible ? IconEyeOff : IconEye} />
            </ToggleButton>
          </InputGroup.Suffix>
        </InputGroup>
        <FieldError>请输入密码</FieldError>
      </TextField>
    </>
  );
}

function PhoneFields({ form }: { form: LoginForm }) {
  const { phone, setPhone, code, setCode, submitted, setSubmitted, phoneValid, setError } = form;
  return (
    <>
      <TextField
        name="phone"
        type="tel"
        value={phone}
        onChange={(value) => {
          setPhone(value);
          setError("");
        }}
        isRequired
        isInvalid={submitted && !phoneValid}
      >
        <Label>手机号</Label>
        <Input
          autoFocus
          autoComplete="tel-national"
          inputMode="tel"
          placeholder="请输入手机号"
          maxLength={11}
        />
        <FieldError>请输入有效的中国大陆手机号</FieldError>
      </TextField>
      <TextField
        name="code"
        value={code}
        onChange={(value) => {
          setCode(value);
          setError("");
        }}
        isRequired
        isInvalid={submitted && !/^\d{6}$/.test(code)}
      >
        <Label>验证码</Label>
        <InputGroup className="login-input-group">
          <InputGroup.Input
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="请输入验证码"
            maxLength={6}
          />
          <InputGroup.Suffix>
            <Button
              type="button"
              variant="tertiary"
              className="login-send-code"
              onPress={() => {
                if (!phoneValid) {
                  setSubmitted(true);
                  return;
                }
                setError("短信验证码服务暂未开放，请稍后再试。");
              }}
            >
              发送验证码
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        <FieldError>请输入6位数字验证码</FieldError>
      </TextField>
    </>
  );
}
