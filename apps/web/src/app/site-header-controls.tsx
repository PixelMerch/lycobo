import type { CSSProperties } from "react";
import { AccountMenu } from "../features/account/menu/account-menu";
import { HeaderBenefits } from "../features/account/menu/header-benefits";
import type { useEnterpriseSession } from "../features/auth/auth-client";
import { HeaderCreationGuide } from "./home-header-utilities";
import { LanguageMenu } from "./language-menu";
import "./site-header-controls.css";

const popoverOffset = 18;

/** 首页与创作页共用创作指南、语言、积分和账户控件。 */
export function SiteHeaderControls({
  account,
  dismissVersion = 0,
  onLanguageChange,
  onMenuOpen,
  style,
  theme = "dark",
}: {
  account: ReturnType<typeof useEnterpriseSession>["data"];
  dismissVersion?: number;
  onLanguageChange?: () => void;
  onMenuOpen?: () => void;
  style?: CSSProperties;
  theme?: "light" | "dark";
}) {
  const menuCallbacks = onMenuOpen ? { onMenuOpen } : {};
  return (
    <div className="landing-header-controls" data-theme={theme} style={style}>
      <HeaderCreationGuide
        dismissVersion={dismissVersion}
        {...menuCallbacks}
        popoverClassName="landing-control-popover"
        popoverOffset={popoverOffset}
      />
      <div className="landing-language-control">
        <LanguageMenu
          dismissVersion={dismissVersion}
          account={account}
          homeGlass
          {...(onLanguageChange ? { onBeforeChange: onLanguageChange } : {})}
          popoverClassName="landing-control-popover landing-language-popover"
          hoverCloseDelay={100}
          popoverOffset={popoverOffset}
          {...menuCallbacks}
        />
      </div>
      {account && (
        <div className="landing-account-controls">
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
