import { Button, FieldError, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { IconEye, IconEyeOff, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../components/ui-icon";

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const accountInvalid = submitted && !account.trim();
  const passwordInvalid = submitted && !password;
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
                <p>登录账户，继续你的创作</p>
              </Modal.Header>
              <Modal.Body>
                <Form
                  className="login-form"
                  validationBehavior="aria"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSubmitted(true);
                    if (!account.trim() || !password) return;
                    setError("账号登录服务暂未开放，请稍后再试。");
                  }}
                >
                  <TextField
                    name="account"
                    value={account}
                    onChange={(value) => {
                      setAccount(value);
                      setError("");
                    }}
                    isRequired
                    isInvalid={accountInvalid}
                  >
                    <Label>账号</Label>
                    <Input
                      autoFocus
                      autoComplete="username"
                      placeholder="请输入账号"
                      maxLength={128}
                    />
                    <FieldError>请输入账号</FieldError>
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
                    isInvalid={passwordInvalid}
                  >
                    <Label>密码</Label>
                    <div className="login-password">
                      <Input
                        autoComplete="current-password"
                        placeholder="请输入密码"
                        maxLength={256}
                      />
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
                    </div>
                    <FieldError>请输入密码</FieldError>
                  </TextField>
                  {error && (
                    <Alert className="login-error" role="alert" status="danger">
                      <Alert.Content>
                        <Alert.Description>{error}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}
                  <Button type="submit" className="primary-action login-submit">
                    登录
                  </Button>
                </Form>
                <p className="login-support">账号问题请联系管理员</p>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
