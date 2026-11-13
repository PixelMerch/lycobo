import {
  IconCircleCheckFilled,
  IconHeart,
  IconMessageCircle,
  IconSend,
  IconStarFilled,
} from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { type Example, exampleImage } from "./hero-showcase-data";
import { showcaseMessages } from "./hero-showcase-messages";
import { ShowcaseMetrics } from "./hero-showcase-metrics";

/** 平台预览卡：用少量平台 UI 让用户看清图片会发布到哪里。 */
function PlatformPreview({ example }: { example: Example }) {
  const t = useMessages(showcaseMessages);
  const copy = t.examples[example.id];
  return (
    <div className="lp-storeOutput" data-platform={example.id}>
      <div className="lp-storePreviewFrame">
        <img alt="" src={exampleImage(example.id, "after")} width="720" height="960" />
        {example.id === "bedding" && (
          <div aria-hidden="true" className="lp-previewChrome lp-previewTikTok">
            <div className="lp-previewHeader">
              <span className="lp-previewAvatar">L</span>
              <span className="lp-previewAuthor">
                <b>Lycobo</b>
                <small>{t.platformUi.sponsored}</small>
              </span>
              <UiIcon icon={IconCircleCheckFilled} size="small" />
            </div>
            <div className="lp-previewRail">
              <span>
                <UiIcon icon={IconHeart} size="small" />
                <small>2.4k</small>
              </span>
              <span>
                <UiIcon icon={IconMessageCircle} size="small" />
                <small>264</small>
              </span>
              <span>
                <UiIcon icon={IconSend} size="small" />
                <small>1.2k</small>
              </span>
            </div>
            <div className="lp-previewFooter">
              <span className="lp-previewStars">★★★★★</span>
              <b>{copy.name}</b>
              <span>{t.platformUi.shopNow}</span>
            </div>
          </div>
        )}
      </div>
      <div className="lp-previewMeta">
        {example.id === "bedding" && <span>{copy.preview}</span>}
        {example.id === "fashion" && (
          <>
            <b>{copy.name}</b>
            <span className="lp-previewRating">
              <UiIcon icon={IconStarFilled} size="small" />
              {example.rating} <small>({example.reviews})</small>
            </span>
            <strong>{example.price}</strong>
            <span className="lp-previewCta">{t.platformUi.addToCart}</span>
          </>
        )}
        {example.id === "serum" && (
          <>
            <b>{copy.name}</b>
            <span className="lp-previewRating">
              <UiIcon icon={IconStarFilled} size="small" />
              {example.rating} <small>({example.reviews})</small>
            </span>
            <strong>{example.price}</strong>
            <span className="lp-previewCta">{t.platformUi.addToCart}</span>
          </>
        )}
        {example.id === "blender" && (
          <>
            <span className="lp-previewPrice">
              <strong>{example.price}</strong>
              <del>{example.compareAt}</del>
            </span>
            <span>
              {t.platformUi.off} · {t.platformUi.sold}
            </span>
            <span className="lp-previewCta">{t.platformUi.freeShipping}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ProductPreview({
  example,
  onInspect,
  onImageSettled,
  ready,
}: {
  example: Example;
  onInspect: (open: boolean) => void;
  onImageSettled: () => void;
  ready: boolean;
}) {
  const t = useMessages(showcaseMessages);
  const copy = t.examples[example.id];
  return (
    <>
      <figure className="lp-storePhoto">
        <img
          alt={copy.after}
          className="lp-storeAfter"
          onLoad={onImageSettled}
          onError={onImageSettled}
          src={exampleImage(example.id, "after")}
          width="720"
          height="960"
        />
        <img
          alt={copy.before}
          className="lp-storeBefore"
          onLoad={onImageSettled}
          onError={onImageSettled}
          src={exampleImage(example.id, "before")}
          width="720"
          height="960"
        />
        <span aria-hidden="true" className="lp-storeSweep" />
        <span className="lp-storePlatformBadge" data-platform={example.id}>
          <img alt="" className="lp-storeBadgeLogo" src={example.logo} width="14" height="14" />
          {example.platform}
        </span>
        <figcaption>
          <strong>{copy.name}</strong>
          <span>{copy.format}</span>
        </figcaption>
      </figure>
      <PlatformPreview example={example} />
      <ShowcaseMetrics example={example} onInspect={onInspect} ready={ready} />
    </>
  );
}

/** 单个平台案例：前后对比、平台预览与数据浮层。 */
export function ShowcaseSlide({
  example,
  onInspect,
}: {
  example: Example;
  onInspect: (open: boolean) => void;
}) {
  const [settledImages, setSettledImages] = useState(0);
  const ready = settledImages >= 2;
  return (
    <div className="lp-storeSlide" data-platform={example.id} data-ready={ready}>
      <ProductPreview
        example={example}
        onInspect={onInspect}
        ready={ready}
        onImageSettled={() => setSettledImages((count) => count + 1)}
      />
    </div>
  );
}

/** 展示原创商品成片、平台预览与标明来源的演示订单数据。 */
