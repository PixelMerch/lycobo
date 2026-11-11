import { Button, Description, InputGroup, Label, TextField } from "@heroui/react";
import { IconBrandAppleFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import { useId } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { authMessages } from "./auth-messages";
import { useSocialLogin } from "./social-login-client";

/** 展示已配置的第三方登录，邮箱入口暂时停用。 */
export function LoginMethods({ returnTo, failed }: { returnTo: string; failed: boolean }) {
  const unavailableId = useId();
  const t = useMessages(authMessages);
  const { providers, start } = useSocialLogin(returnTo);
  return (
    <div className="login-methods">
      <div className="login-social-methods">
        <Button
          variant="secondary"
          size="lg"
          className="login-social"
          isDisabled={!providers.includes("google") || start.isPending}
          onPress={() => start.mutate("google")}
        >
          <UiIcon icon={IconBrandGoogleFilled} />
          {t.google}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="login-social"
          isDisabled={!providers.includes("apple") || start.isPending}
          onPress={() => start.mutate("apple")}
        >
          <UiIcon icon={IconBrandAppleFilled} />
          {t.apple}
        </Button>
      </div>
      {(failed || start.isError) && (
        <p role="alert" className="login-unavailable">
          {t.socialFailed}
        </p>
      )}
      <span className="login-divider">{t.or}</span>
      <div className="login-fields login-email">
        <TextField name="email" type="email" isDisabled aria-describedby={unavailableId}>
          {/* 邮箱框只显示占位文字，名称留给读屏软件。 */}
          <Label className="visually-hidden">{t.email}</Label>
          <InputGroup className="login-input-group">
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
      </div>
      <Description id={unavailableId} className="login-unavailable">
        {providers.length ? t.emailUnavailable : t.otherMethodsUnavailable}
      </Description>
    </div>
  );
}
