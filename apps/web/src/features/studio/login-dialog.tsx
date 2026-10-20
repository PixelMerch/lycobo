import {
  Alert,
  Button,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { IconEye, IconEyeOff, IconQrcode, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../components/ui-icon";

type LoginMode = "wechat" | "phone" | "enterprise";
const loginMethods: { mode: LoginMode; label: string }[] = [
  { mode: "wechat", label: "公众号扫码登录" },
  { mode: "phone", label: "手机号登录" },
  { mode: "enterprise", label: "企业账号登录" },
];
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<LoginMode>("wechat");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const phoneValid = /^1[3-9]\d{9}$/.test(phone);
  const switchMode = (next: LoginMode) => {
    setMode(next);
    setSubmitted(false);
    setError("");
    setPassword("");
    setCode("");
    setVisible(false);
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="login-backdrop">
        <Modal.Container>
          <Modal.Dialog className="login-dialog">
            <Modal.CloseTrigger className="login-close" aria-label="关闭登录" />
            <div className="login-visual">
              <img src="/studio/bedroom.webp" alt="自然光下的奶油白家纺卧室场景" />
              <div className="login-visual-copy">
                <span className="login-kicker">LYCOBOAI · 创作工作台</span>
                <h2>
                  让商品，
                  <br />
                  拥有新的画面。
                </h2>
                <p>从一张参考图开始，探索你的下一份创意。</p>
              </div>
            </div>
            <div className="login-content">
              <Modal.Header>
                <span className="login-brand-mark">
                  <UiIcon icon={IconSparkles} size="action" />
                </span>
                <Modal.Heading>欢迎使用 lycoboai</Modal.Heading>
                <p>{loginMethods.find((method) => method.mode === mode)?.label}</p>
              </Modal.Header>
              <Modal.Body>
                {mode === "wechat" ? (
                  <div className="login-wechat">
                    <div
                      className="login-qr-unavailable"
                      role="status"
                      aria-label="扫码登录暂未开放"
                    >
                      <UiIcon icon={IconQrcode} size="illustration" />
                      <span>扫码登录暂未开放</span>
                    </div>
                    <p>微信扫码，登录创作工作台</p>
                  </div>
                ) : (
                  <Form
                    key={mode}
                    className="login-form"
                    validationBehavior="aria"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setSubmitted(true);
                      if (mode === "enterprise") {
                        if (!account.trim() || !password) return;
                        setError("企业账号登录服务暂未开放，请稍后再试。");
                      } else {
                        if (!phoneValid || !/^\d{6}$/.test(code)) return;
                        setError("手机号登录服务暂未开放，请稍后再试。");
                      }
                    }}
                  >
                    {mode === "enterprise" ? (
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
                          <Input
                            autoFocus
                            autoComplete="username"
                            placeholder="请输入企业账号"
                            maxLength={128}
                          />
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
                              autoComplete="current-password"
                              placeholder="请输入密码"
                              maxLength={256}
                            />
                            <InputGroup.Suffix>
                              <Button
                                type="button"
                                isIconOnly
                                variant="tertiary"
                                aria-label={visible ? "隐藏密码" : "显示密码"}
                                aria-pressed={visible}
                                onPress={() => setVisible(!visible)}
                              >
                                <UiIcon icon={visible ? IconEyeOff : IconEye} />
                              </Button>
                            </InputGroup.Suffix>
                          </InputGroup>
                          <FieldError>请输入密码</FieldError>
                        </TextField>
                      </>
                    ) : (
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
                                获取验证码
                              </Button>
                            </InputGroup.Suffix>
                          </InputGroup>
                          <FieldError>请输入6位数字验证码</FieldError>
                        </TextField>
                      </>
                    )}
                    {error && (
                      <Alert className="login-error" status="danger" role="alert">
                        <Alert.Content>
                          <Alert.Description>{error}</Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}
                    <Button type="submit" className="primary-action login-submit">
                      登录
                    </Button>
                  </Form>
                )}
                <section className="login-methods" aria-label="其他登录方式">
                  <span>其他登录方式</span>
                  <div>
                    {loginMethods
                      .filter((method) => method.mode !== mode)
                      .map((method) => (
                        <Button
                          key={method.mode}
                          variant="tertiary"
                          onPress={() => switchMode(method.mode)}
                        >
                          {method.label}
                        </Button>
                      ))}
                  </div>
                </section>
                <p className="login-support">账号问题请联系管理员</p>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
