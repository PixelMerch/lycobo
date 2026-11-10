import { useLayoutEffect } from "react";
import { RouteLink } from "../../components/router-link";
import { type MessageCatalog, useMessages } from "../../i18n/messages";
import { SiteFooter } from "../site/site-footer";
import {
  type LegalBlock,
  type LegalDocument,
  type LegalDocumentId,
  legalDocumentIds,
  legalPaths,
} from "./legal-document";
import { legalEntityMessages } from "./legal-entity-messages";
import { legalMessages } from "./legal-messages";
import { privacyMessages } from "./privacy-messages";
import { termsMessages } from "./terms-messages";
import "./legal-page.css";

const documents = { terms: termsMessages, privacy: privacyMessages } satisfies Record<
  LegalDocumentId,
  MessageCatalog<LegalDocument>
>;

/** 用户协议页面，公开访问。 */
export function TermsPage() {
  return <LegalPage id="terms" />;
}

/** 隐私政策页面，公开访问。 */
export function PrivacyPage() {
  return <LegalPage id="privacy" />;
}

/** 一份法律文本的阅读页：顶部切换两份文本，正文按节编号排版，底部接站点页脚。 */
function LegalPage({ id }: { id: LegalDocumentId }) {
  const t = useMessages(legalMessages);
  const entity = useMessages(legalEntityMessages);
  const legalDocument = useMessages(documents[id]);
  // 从页脚点进来时窗口还停在原来的滚动位置；两份文本是不同路由，打开或切换都会重新挂载并回到顶部。
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="legal-page">
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
          {t.updated(entity.updatedDate)} · {t.effective(entity.effectiveDate)}
        </p>
        <p className="legal-intro">{legalDocument.intro}</p>
        {legalDocument.sections.map((section, index) => (
          <section key={section.heading} className="legal-section">
            <h2>{`${index + 1}. ${section.heading}`}</h2>
            {section.blocks.map((block) => (
              <LegalBlockView
                key={typeof block === "string" ? block : block.join("\n")}
                block={block}
              />
            ))}
          </section>
        ))}
      </article>
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
