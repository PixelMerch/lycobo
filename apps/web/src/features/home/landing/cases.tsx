import { Button } from "@heroui/react";
import { lazy, Suspense, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { casesMessages } from "./cases-messages";
import { type CaseCard, caseCards } from "./commerce-content";

const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 单张案例卡：宽卡可带整体图与细节组图，并复用全屏图片浏览器查看。 */
function CaseItem({
  card,
  duplicate,
  onOpen,
}: {
  card: CaseCard;
  duplicate: boolean;
  onOpen?: () => void;
}) {
  const t = useMessages(casesMessages);
  const copy = t.cards[card.id];
  const visual = card.details ? (
    <div className="lp-caseDetail">
      <img alt={copy.alt} className="lp-caseDetailMain" src={card.image} />
      <div className="lp-caseDetailGrid">
        {card.details.map((detail) => (
          <img alt={t.detailAlt[detail.id]} key={detail.id} loading="lazy" src={detail.image} />
        ))}
      </div>
    </div>
  ) : (
    <img alt={copy.alt} loading="lazy" src={card.image} />
  );
  const body = (
    <>
      {visual}
      <div>
        <b>{copy.title}</b>
      </div>
    </>
  );
  return (
    <div className="lp-caseItem" data-format={card.format === "compact" ? undefined : card.format}>
      {onOpen && !duplicate ? (
        <Button
          aria-label={t.openDetails(copy.title)}
          className="lp-caseCard lp-caseCardButton"
          onPress={onOpen}
        >
          {body}
        </Button>
      ) : (
        <div className="lp-caseCard">{body}</div>
      )}
    </div>
  );
}

function CaseTrack({ duplicate = false, onOpen }: { duplicate?: boolean; onOpen?: () => void }) {
  return (
    <div aria-hidden={duplicate || undefined} className="lp-casesSet" inert={duplicate}>
      {caseCards.map((card) => (
        <CaseItem
          card={card}
          duplicate={duplicate}
          key={card.id}
          {...(card.id === "jacket" && !duplicate ? { onOpen } : {})}
        />
      ))}
    </div>
  );
}

/** 商品图案例横滑：两组相同内容首尾衔接，悬停由 CSS 暂停。 */
export function Cases() {
  const t = useMessages(casesMessages);
  const [jacketOpen, setJacketOpen] = useState(false);
  const jacket = caseCards.find((card) => card.id === "jacket");
  const viewerImages = jacket?.details
    ? [
        { src: jacket.image, alt: t.cards.jacket.alt },
        ...jacket.details.map((detail) => ({
          src: detail.image,
          alt: t.detailAlt[detail.id],
        })),
        { src: "/landing/commerce/p11-jacket-mother.webp", alt: t.referenceAlt },
      ]
    : [];
  return (
    <section aria-labelledby="campaign-cases-title" className="lp-cases">
      <div className="lp-sectionHeading">
        <span className="cn-badge lp-eyebrow">{t.eyebrow}</span>
        <h2 id="campaign-cases-title">{t.title}</h2>
        <p>{t.description}</p>
      </div>

      <div className="lp-casesCarousel">
        <div className="lp-casesTrack">
          <CaseTrack onOpen={() => setJacketOpen(true)} />
          <CaseTrack duplicate />
        </div>
      </div>
      {jacketOpen && viewerImages.length > 0 && (
        <Suspense fallback={null}>
          <ImageViewer images={viewerImages} onClose={() => setJacketOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
