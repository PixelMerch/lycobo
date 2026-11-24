import { useLayoutEffect, useRef } from "react";
import { RouteLink } from "../../components/router-link";
import { useLocale } from "../../i18n/locale-store";
import { type MessageCatalog, useMessages } from "../../i18n/messages";
import { SiteFooter } from "../site/site-footer";
import { LegalContents } from "./legal-contents";
import {
  type LegalBlock,
  type LegalDocument,
  type LegalDocumentId,
  legalDocumentIds,
  legalPaths,
  legalSectionId,
} from "./legal-document";
import { legalEntityMessages } from "./legal-entity-messages";
import { legalMessages } from "./legal-messages";
import { privacyMessages } from "./privacy-messages";
import { refundMessages } from "./refund-messages";
import { termsMessages } from "./terms-messages";
import "./legal-page.css";

const documents = {
  terms: termsMessages,
  privacy: privacyMessages,
  refunds: refundMessages,
} satisfies Record<LegalDocumentId, MessageCatalog<LegalDocument>>;

/** 用户协议页面，公开访问。 */
export function TermsPage() {
  return <LegalPage id="terms" />;
}

/** 隐私政策页面，公开访问。 */
export function PrivacyPage() {
  return <LegalPage id="privacy" />;
}

/** 积分退款政策页面，公开访问。 */
export function RefundPage() {
  return <LegalPage id="refunds" />;
}

/** 黑底法律阅读页：左侧目录、右侧正文，语言切换保留同一章节。 */
function LegalPage({ id }: { id: LegalDocumentId }) {
  const t = useMessages(legalMessages);
  const entity = useMessages(legalEntityMessages);
  const legalDocument = useMessages(documents[id]);
  const locale = useLocale();
  const effectiveDate =
    legalDocument.effectiveDate === undefined ? entity.effectiveDate : legalDocument.effectiveDate;
  const documentKey = `${locale}:${id}`;
  const previousDocument = useRef<string | null>(null);
  // 首次打开支持章节直达；没有有效锚点时回到文档顶部。
  useLayoutEffect(() => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.id.startsWith(`${id}-section-`))
      target.scrollIntoView({ block: "start", behavior: "instant" });
    else if (previousDocument.current !== documentKey)
      window.scrollTo({ top: 0, behavior: "instant" });
    previousDocument.current = documentKey;
  }, [id, documentKey]);
  return (
    <div className="legal-page">
      <div className="legal-layout">
        <aside className="legal-sidebar">
          <LegalContents id={id} sections={legalDocument.sections} />
        </aside>
        <article className="legal-document" aria-labelledby="legal-title">
          <nav className="legal-switch" aria-label={t.navigation}>
            {legalDocumentIds.map((documentId) => (
              <RouteLink
                key={documentId}
                to={legalPaths[documentId]}
                className="legal-switch-link"
                nav
                end
              >
                {t.names[documentId]}
              </RouteLink>
            ))}
          </nav>
          <h1 id="legal-title">{legalDocument.title}</h1>
          <p className="legal-meta">
            {t.updated(legalDocument.updatedDate ?? entity.updatedDate)}
            {effectiveDate && ` · ${t.effective(effectiveDate)}`}
          </p>
          <p className="legal-intro">{legalDocument.intro}</p>
          {legalDocument.sections.map((section, index) => (
            <section key={legalSectionId(id, index)} className="legal-section">
              <h2
                id={legalSectionId(id, index)}
                tabIndex={-1}
              >{`${index + 1}. ${section.heading}`}</h2>
              {section.blocks.map((block) => (
                <LegalBlockView
                  key={typeof block === "string" ? block : block.join("\n")}
                  block={block}
                />
              ))}
            </section>
          ))}
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}

/** 正文的一块：一段文字，或一组列表项。 */
function LegalBlockView({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul>
      {block.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
