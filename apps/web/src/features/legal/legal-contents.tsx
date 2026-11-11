import { Link } from "@heroui/react";
import { useMessages } from "../../i18n/messages";
import { type LegalDocument, type LegalDocumentId, legalSectionId } from "./legal-document";
import { legalMessages } from "./legal-messages";
import { useLegalContents } from "./use-legal-contents";

/** 法律阅读目录：使用原生章节锚点，保留键盘导航与可分享的定位地址。 */
export function LegalContents({
  id,
  sections,
}: {
  id: LegalDocumentId;
  sections: LegalDocument["sections"];
}) {
  const t = useMessages(legalMessages);
  const activeIndex = useLegalContents(id, sections.length);
  return (
    <nav className="legal-contents" aria-label={t.contents}>
      <h2 className="legal-contents-heading">{t.contents}</h2>
      <ol className="legal-contents-list">
        {sections.map((section, index) => (
          <li key={legalSectionId(id, index)}>
            <Link
              href={`#${legalSectionId(id, index)}`}
              className="legal-contents-link"
              aria-current={activeIndex === index ? "location" : false}
            >
              <span className="legal-contents-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{section.heading}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
