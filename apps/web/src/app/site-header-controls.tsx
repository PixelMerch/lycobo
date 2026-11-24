import { IconBook, IconLayoutDashboard } from "@tabler/icons-react";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountMenu } from "../features/account/menu/account-menu";
import { HeaderBenefits } from "../features/account/menu/header-benefits";
import type { useEnterpriseSession } from "../features/auth/auth-client";
import { creationGuidePath } from "../features/guide/creation-guide-path";
import { useMessages } from "../i18n/messages";
import { dashboardPath } from "../lib/dashboard-paths";
import { LanguageMenu } from "./language-menu";
import { shellMessages } from "./shell-messages";
import "./site-header-controls.css";

const popoverOffset = 18;

/** 首页、灵感库与创作页共用的顶栏控件，创作页可省略工作区入口。 */
export function SiteHeaderControls({
  account,
  dismissVersion = 0,
  onLanguageChange,
  showWorkspaceLink = true,
}: {
  account: ReturnType<typeof useEnterpriseSession>["data"];
  dismissVersion?: number;
  onLanguageChange?: () => void;
  showWorkspaceLink?: boolean;
}) {
  const t = useMessages(shellMessages);
  return (
    <div className="landing-header-controls">
      <RouteLink
        to={creationGuidePath}
        className="header-creation-guide"
        aria-label={t.creationHelp}
      >
        <UiIcon icon={IconBook} size="navigation" />
      </RouteLink>
      <div className="landing-language-control">
        <LanguageMenu
          dismissVersion={dismissVersion}
          account={account}
          homeGlass
          {...(onLanguageChange ? { onBeforeChange: onLanguageChange } : {})}
          popoverClassName="landing-control-popover landing-language-popover"
          hoverCloseDelay={100}
          popoverOffset={popoverOffset}
        />
      </div>
      {account && (
        <div className="landing-account-controls">
          {showWorkspaceLink && <WorkspaceHeaderLink />}
          <HeaderBenefits
            dismissVersion={dismissVersion}
            popoverClassName="landing-control-popover"
            popoverOffset={popoverOffset}
          />
          <AccountMenu
            hover
            dismissVersion={dismissVersion}
            variant="header"
            popoverClassName="landing-control-popover"
            popoverOffset={popoverOffset}
          />
        </div>
      )}
    </div>
  );
}

/** 登录后的顶栏入口，按当前语言打开工作区。 */
export function WorkspaceHeaderLink() {
  const t = useMessages(shellMessages);
  return (
    <RouteLink to={dashboardPath} className="header-workspace" aria-label={t.workspace}>
      <UiIcon icon={IconLayoutDashboard} size="navigation" />
      <span>{t.workspace}</span>
    </RouteLink>
  );
}
