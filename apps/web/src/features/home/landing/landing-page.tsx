import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { landingCopy } from "./landing-copy";
import { referenceMessages } from "./reference-messages";
import { renderLandingDocument } from "./render-landing-document";
import "./reference.css";

async function loadLandingTemplate(signal: AbortSignal) {
  const response = await fetch("/openart-reference/index.html", { signal });
  if (!response.ok) throw new Error("LANDING_TEMPLATE_UNAVAILABLE");
  return response.text();
}

/** 在隔离模板中呈现 Lycobo 双语内容，保留已确认的布局与滚动动效。 */
export function CommerceLanding() {
  const locale = useLocale();
  const t = useMessages(referenceMessages);
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
    <iframe
      className="openart-reference"
      title={t.title}
      srcDoc={document}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
    />
  );
}
