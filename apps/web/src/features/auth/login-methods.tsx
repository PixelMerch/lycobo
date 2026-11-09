import { Button, Description, InputGroup, Label, TextField } from "@heroui/react";
import { IconBrandAppleFilled, IconBrandGoogleFilled, IconMail } from "@tabler/icons-react";
import { useId } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { authMessages } from "./auth-messages";

/** 预留第三方与邮箱入口，接入认证前不发请求或模拟发送验证码。 */
export function LoginMethods() {
  const unavailableId = useId();
  const t = useMessages(authMessages);
  return (
    <div className="login-methods">
      <div className="login-social-methods" aria-describedby={unavailableId}>
        <Button variant="secondary" size="lg" className="login-social" isDisabled>
          <UiIcon icon={IconBrandGoogleFilled} />
          {t.google}
        </Button>
        <Button variant="secondary" size="lg" className="login-social" isDisabled>
          <UiIcon icon={IconBrandAppleFilled} />
          {t.apple}
        </Button>
      </div>
      <span className="login-divider">{t.orEmail}</span>
      <div className="login-fields login-email">
        <TextField name="email" type="email" isDisabled aria-describedby={unavailableId}>
          <Label>{t.email}</Label>
          <InputGroup className="login-input-group">
            <InputGroup.Prefix>
              <UiIcon icon={IconMail} />
            </InputGroup.Prefix>
            <InputGroup.Input autoComplete="email" placeholder={t.emailPlaceholder} />
          </InputGroup>
        </TextField>
        <Button
          size="lg"
          className="login-email-submit"
          isDisabled
          aria-describedby={unavailableId}
        >
          {t.sendCode}
        </Button>
        <Description id={unavailableId} className="login-unavailable">
          {t.otherMethodsUnavailable}
        </Description>
      </div>
    </div>
  );
}
