import { Button, Description, InputGroup, Label, TextField } from "@heroui/react";
import { IconBrandAppleFilled, IconBrandGoogleFilled, IconMail } from "@tabler/icons-react";
import { useId } from "react";
import { UiIcon } from "../../components/ui-icon";

/** 预留第三方与邮箱入口，接入认证前不发请求或模拟发送验证码。 */
export function LoginMethods() {
  const unavailableId = useId();
  return (
    <div className="login-methods">
      <div className="login-social-methods" aria-describedby={unavailableId}>
        <Button variant="secondary" size="lg" className="login-social" isDisabled>
          <UiIcon icon={IconBrandGoogleFilled} />
          使用 Google 登录
        </Button>
        <Button variant="secondary" size="lg" className="login-social" isDisabled>
          <UiIcon icon={IconBrandAppleFilled} />
          使用 Apple 登录
        </Button>
      </div>
      <span className="login-divider">或使用邮箱</span>
      <div className="login-fields login-email">
        <TextField name="email" type="email" isDisabled aria-describedby={unavailableId}>
          <Label>邮箱</Label>
          <InputGroup className="login-input-group">
            <InputGroup.Prefix>
              <UiIcon icon={IconMail} />
            </InputGroup.Prefix>
            <InputGroup.Input autoComplete="email" placeholder="请输入邮箱地址" />
          </InputGroup>
        </TextField>
        <Button
          size="lg"
          className="login-email-submit"
          isDisabled
          aria-describedby={unavailableId}
        >
          发送验证码
        </Button>
        <Description id={unavailableId} className="login-unavailable">
          Google、Apple 和邮箱登录暂未开放
        </Description>
      </div>
    </div>
  );
}
