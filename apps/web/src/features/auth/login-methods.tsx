import { Button, Description, Spinner } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconBrandAppleFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { authMessages } from "./auth-messages";
import { EmailLogin } from "./email-login";
import { useSocialLogin } from "./social-login-client";

const socialButtons = [
  { provider: "google", icon: IconBrandGoogleFilled },
  { provider: "apple", icon: IconBrandAppleFilled },
] as const;

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
  const { providers, emailSiteKey, start, redirecting } = useSocialLogin(returnTo);
  return (
    <div className="login-methods">
      <div className="login-social-methods">
        {socialButtons.map(({ provider, icon }) => {
          // 被点的按钮在跳转前一直转圈（同生成按钮），另一个先停用，避免同时发起两次授权。
          const active = redirecting === provider;
          return (
            <Button
              key={provider}
              variant="secondary"
              size="lg"
              className="login-social"
              isPending={active}
              isDisabled={!providers.includes(provider) || (redirecting !== undefined && !active)}
              onPress={() => start.mutate(provider)}
            >
              {active ? (
                <Spinner size="sm" color="current" role="status" aria-label={t.signingIn} />
              ) : (
                <UiIcon icon={icon} />
              )}
              {t[provider]}
            </Button>
          );
        })}
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
