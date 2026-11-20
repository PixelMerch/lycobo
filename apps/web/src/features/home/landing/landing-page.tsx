import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useOutletContext } from "react-router";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { refundPolicyUrl, siteFooterSupportHref } from "../../site/site-footer-navigation";
import { landingCopy } from "./landing-copy";
import { type LandingFrame, readLandingNavigation, scrollLandingFrame } from "./landing-frame";
import { referenceMessages } from "./reference-messages";
import { renderLandingDocument } from "./render-landing-document";
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
  const { frameRef, pendingScroll } = useOutletContext<LandingFrame>();
  const navigate = useAppNavigate();
  const { data, isError } = useQuery({
    queryKey: ["commerce-landing-template"],
    queryFn: ({ signal }) => loadLandingTemplate(signal),
    staleTime: Infinity,
  });
  const document = useMemo(
    () => (data ? renderLandingDocument(data, landingCopy(locale), locale) : undefined),
    [data, locale],
  );
  useEffect(() => {
    function followLink(event: MessageEvent<unknown>) {
      // sandbox 的来源为 null，只接收本页所持窗口的消息。
      if (event.source !== frameRef.current?.contentWindow) return;
      const path = readLandingNavigation(event.data);
      if (path === refundPolicyUrl || path === siteFooterSupportHref) window.location.assign(path);
      else if (path) void navigate(path);
    }
    window.addEventListener("message", followLink);
    return () => window.removeEventListener("message", followLink);
  }, [frameRef, navigate]);

  useEffect(
    () => () => {
      pendingScroll.current = null;
    },
    [pendingScroll],
  );

  function restoreScroll() {
    const scrollY = pendingScroll.current;
    if (scrollY === null) return;
    pendingScroll.current = null;
    scrollLandingFrame(frameRef, scrollY);
  }

  if (!document) {
    return (
      <div className="openart-reference landing-load-state" role="status">
        {isError ? t.unavailable : t.loading}
      </div>
    );
  }
  return (
    <iframe
      ref={frameRef}
      onLoad={restoreScroll}
      className="openart-reference"
      title={t.title}
      srcDoc={document}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
    />
  );
}
