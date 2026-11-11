import { Button, Description } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconBrandAppleFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { authMessages } from "./auth-messages";
import { EmailLogin } from "./email-login";
import { useSocialLogin } from "./social-login-client";

/** 展示已配置的第三方和邮箱登录入口。 */
export function LoginMethods({
  returnTo,
  failed,
  onLoginSuccess,
}: {
  returnTo: string;
  failed: boolean;
  onLoginSuccess: (account: EnterpriseIdentity) => void;
}) {
  const t = useMessages(authMessages);
  const { providers, emailSiteKey, start } = useSocialLogin(returnTo);
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
      <EmailLogin siteKey={emailSiteKey} onLoginSuccess={onLoginSuccess} />
      {!emailSiteKey && (
        <Description className="login-unavailable">
          {providers.length ? t.emailUnavailable : t.otherMethodsUnavailable}
        </Description>
      )}
    </div>
  );
}
