import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { HeaderCreationGuide } from "../../../app/home-header-utilities";
import { LanguageMenu } from "../../../app/language-menu";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { AccountMenu } from "../../account/menu/account-menu";
import { HeaderBenefits } from "../../account/menu/header-benefits";
import { useEnterpriseSession } from "../../auth/auth-client";
import { LandingBrandCanvas } from "./landing-brand-canvas";
import { landingCopy } from "./landing-copy";
import { referenceMessages } from "./reference-messages";
import { renderLandingDocument } from "./render-landing-document";
import { useLandingLanguage } from "./use-landing-language";
import "./reference.css";

const headerPopoverOffset = 18;

async function loadLandingTemplate(signal: AbortSignal) {
  const response = await fetch("/openart-reference/index.html", { signal });
  if (!response.ok) throw new Error("LANDING_TEMPLATE_UNAVAILABLE");
  return response.text();
}

/** 在语言首页呈现 Lycobo 双语落地页，保留已确认的布局与滚动动效。 */
export function LandingPage() {
  const locale = useLocale();
  const t = useMessages(referenceMessages);
  const { data: account } = useEnterpriseSession();
  const { frameRef, anchor, dismissVersion, prepareLanguageChange, syncFrame, closeNavigation } =
    useLandingLanguage(!!account);
  const { data, isError } = useQuery({
    queryKey: ["commerce-landing-template"],
    queryFn: ({ signal }) => loadLandingTemplate(signal),
    staleTime: Infinity,
  });
  const document = useMemo(
    () => (data ? renderLandingDocument(data, landingCopy(locale), locale) : undefined),
    [data, locale],
  );
  if (!document) {
    return (
      <div className="openart-reference landing-load-state" role="status">
        {isError ? t.unavailable : t.loading}
      </div>
    );
  }
  return (
    <>
      <iframe
        ref={frameRef}
        onLoad={syncFrame}
        className="openart-reference"
        title={t.title}
        srcDoc={document}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
      <LandingBrandCanvas frameRef={frameRef} document={document} />
      {anchor && !anchor.menuOpen && (
        <div
          className="landing-header-controls"
          data-theme={anchor.theme}
          style={{ left: anchor.x, top: anchor.y, width: anchor.width, height: anchor.height }}
        >
          <HeaderCreationGuide
            dismissVersion={dismissVersion}
            onMenuOpen={closeNavigation}
            popoverClassName="landing-control-popover"
            popoverOffset={headerPopoverOffset}
          />
          <div className="landing-language-control">
            <LanguageMenu
              dismissVersion={dismissVersion}
              account={account}
              homeGlass
              onBeforeChange={prepareLanguageChange}
              popoverClassName="landing-control-popover landing-language-popover"
              hoverCloseDelay={100}
              popoverOffset={headerPopoverOffset}
              onMenuOpen={closeNavigation}
            />
          </div>
          {account && anchor.signedIn && (
            <div className="landing-account-controls">
              <HeaderBenefits
                dismissVersion={dismissVersion}
                popoverClassName="landing-control-popover"
                popoverOffset={headerPopoverOffset}
              />
              <AccountMenu
                hover
                dismissVersion={dismissVersion}
                variant="header"
                popoverClassName="landing-control-popover"
                popoverOffset={headerPopoverOffset}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
