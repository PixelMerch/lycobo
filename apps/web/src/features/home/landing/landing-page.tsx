import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { LanguageMenu } from "../../../app/language-menu";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { LandingBrandCanvas } from "./landing-brand-canvas";
import { landingCopy } from "./landing-copy";
import { referenceMessages } from "./reference-messages";
import { renderLandingDocument } from "./render-landing-document";
import { useLandingLanguage } from "./use-landing-language";
import "./reference.css";

async function loadLandingTemplate(signal: AbortSignal) {
  const response = await fetch("/openart-reference/index.html", { signal });
  if (!response.ok) throw new Error("LANDING_TEMPLATE_UNAVAILABLE");
  return response.text();
}

/** 在语言首页呈现 Lycobo 双语落地页，保留已确认的布局与滚动动效。 */
export function LandingPage() {
  const locale = useLocale();
  const t = useMessages(referenceMessages);
  const {
    frameRef,
    anchor,
    dismissVersion,
    prepareLanguageChange,
    restoreScroll,
    closeNavigation,
  } = useLandingLanguage();
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
        onLoad={restoreScroll}
        className="openart-reference"
        title={t.title}
        srcDoc={document}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
      <LandingBrandCanvas frameRef={frameRef} document={document} />
      {anchor && (
        <div
          className="landing-language-control"
          data-theme={anchor.theme}
          style={{ left: anchor.x, top: anchor.y, width: anchor.width, height: anchor.height }}
        >
          <LanguageMenu
            dismissVersion={dismissVersion}
            account={null}
            homeGlass
            onBeforeChange={prepareLanguageChange}
            popoverClassName="landing-language-popover"
            hoverCloseDelay={100}
            popoverOffset={18}
            onMenuOpen={closeNavigation}
          />
        </div>
      )}
    </>
  );
}
