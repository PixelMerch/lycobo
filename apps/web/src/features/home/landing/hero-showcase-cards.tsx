import { Button, Popover } from "@heroui/react";
import {
  IconArrowUp,
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

function SalesPreview({
  example,
  onInspect,
}: {
  example: Example;
  onInspect: (open: boolean) => void;
}) {
  const t = useMessages(showcaseMessages);
  const change = Math.round(((example.orders[1] - example.orders[0]) / example.orders[0]) * 100);
  return (
    <div className="lp-metricStack">
      <Popover onOpenChange={onInspect}>
        <Button aria-label={t.viewSales} className="lp-storeSales lp-roasCard" variant="tertiary">
          <span className="lp-roasTop">
            <UiIcon icon={IconArrowUp} size="small" /> {t.platformUi.roas}
          </span>
          <strong>4.2X</strong>
          <small>{t.platformUi.roasCaption}</small>
          <em>
            {t.demoData} · +{change}% {t.orders}
          </em>
        </Button>
        <Popover.Content className="lp-storeSalesPopover" placement="bottom end">
          <Popover.Dialog aria-label={t.viewSales}>
            <table>
              <caption>{t.period}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.metric}</th>
                  <th scope="col">{t.before}</th>
                  <th scope="col">{t.after}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t.platformUi.roas}</th>
                  <td>3.6X</td>
                  <td>4.2X</td>
                </tr>
                <tr>
                  <th scope="row">{t.visits}</th>
                  <td>{example.visits[0]}</td>
                  <td>{example.visits[1]}</td>
                </tr>
                <tr>
                  <th scope="row">{t.orders}</th>
                  <td>{example.orders[0]}</td>
                  <td>{example.orders[1]}</td>
                </tr>
                <tr>
                  <th scope="row">{t.platformUi.conversion}</th>
                  <td>79%</td>
                  <td>86%</td>
                </tr>
                <tr>
                  <th scope="row">{t.platformUi.rating}</th>
                  <td>4.6</td>
                  <td>4.9</td>
                </tr>
              </tbody>
            </table>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <span className="lp-metricLivePill">
        <i>
          <UiIcon icon={IconArrowUp} size="small" />
        </i>
        {t.platformUi.liveWatching}
      </span>
    </div>
  );
}

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
                <small>18.3k</small>
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
        <span className="lp-previewPlatform">{example.platform}</span>
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
}: {
  example: Example;
  onInspect: (open: boolean) => void;
  onImageSettled: () => void;
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
          {example.platform}
        </span>
        <figcaption>
          <strong>{copy.name}</strong>
          <span>{copy.format}</span>
        </figcaption>
      </figure>
      <PlatformPreview example={example} />
      <SalesPreview example={example} onInspect={onInspect} />
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
  return (
    <div className="lp-storeSlide" data-platform={example.id} data-ready={settledImages >= 2}>
      <ProductPreview
        example={example}
        onInspect={onInspect}
        onImageSettled={() => setSettledImages((count) => count + 1)}
      />
    </div>
  );
}

/** 展示原创商品成片、平台预览与标明来源的演示订单数据。 */
