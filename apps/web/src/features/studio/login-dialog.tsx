import {
  Alert,
  Button,
  Chip,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Modal,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { IconEye, IconEyeOff, IconQrcode, IconSparkles } from "@tabler/icons-react";
import { type Key, useState } from "react";
import { UiIcon } from "../../components/ui-icon";

type LoginMode = "wechat" | "phone" | "enterprise";
const loginMethods: { mode: LoginMode; label: string; hint: string }[] = [
  { mode: "wechat", label: "微信扫码", hint: "使用微信扫码登录创作工作台" },
  { mode: "phone", label: "手机号", hint: "使用手机号和验证码登录" },
  { mode: "enterprise", label: "企业账号", hint: "使用企业账号和密码登录" },
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
  const current = loginMethods.find((method) => method.mode === mode);
  const hint = current ? current.hint : loginMethods[0]?.hint;
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
              <Modal.Header className="login-header">
                <span className="login-brand-mark" aria-hidden="true">
                  <UiIcon icon={IconSparkles} size="action" />
                </span>
                <div className="login-heading">
                  <Modal.Heading>欢迎使用 lycoboai</Modal.Heading>
                  <p>{hint}</p>
                </div>
              </Modal.Header>
              <Modal.Body className="login-body">
                <ToggleButtonGroup
                  aria-label="登录方式"
                  className="login-modes"
                  disallowEmptySelection
                  isDetached
                  selectedKeys={[mode]}
                  selectionMode="single"
                  size="sm"
                  onSelectionChange={(keys: Set<Key>) => {
                    const [next] = [...keys];
                    if (next !== undefined && next !== mode) switchMode(next as LoginMode);
                  }}
                >
                  {loginMethods.map((method) => (
                    <ToggleButton key={method.mode} id={method.mode}>
                      {method.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
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
                    <div className="login-wechat-copy">
                      <Chip color="accent" size="sm" variant="tertiary">
                        即将开放
                      </Chip>
                      <p>开放后可用微信扫码进入工作台，现在请先用手机号或企业账号登录。</p>
                    </div>
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
                <p className="login-support">账号问题请联系管理员</p>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
