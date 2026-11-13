import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import {
  IconArrowUp,
  IconBrandAmazon,
  IconBrandTiktok,
  IconCircleCheckFilled,
  IconHeart,
  IconMessageCircle,
  IconSend,
  IconStarFilled,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { showcaseMessages } from "./hero-showcase-messages";
import { useHeroPlayback } from "./use-hero-playback";

const examples = [
  {
    id: "bedding",
    platform: "TikTok Shop",
    price: "$59.99",
    rating: "4.9",
    reviews: "1,284",
    orders: [22, 31],
    visits: [1100, 1240],
  },
  {
    id: "fashion",
    platform: "Amazon",
    price: "$89.99",
    rating: "4.8",
    reviews: "2,106",
    orders: [35, 44],
    visits: [1500, 1680],
  },
  {
    id: "blender",
    platform: "Temu",
    price: "$12.99",
    compareAt: "$19.99",
    rating: "4.7",
    reviews: "8,942",
    orders: [28, 37],
    visits: [1350, 1460],
  },
] as const;

type Example = (typeof examples)[number];
export type HeroExampleId = Example["id"];

function nextExample(active: HeroExampleId) {
  const index = examples.findIndex((example) => example.id === active);
  return examples[(index + 1) % examples.length]?.id ?? examples[0].id;
}

function exampleImage(id: HeroExampleId, phase: "before" | "after") {
  return `/landing/showcase/${id}-${phase}.webp`;
}

/** 平台彩色标记：用品牌色和图标代替纯文字，提高扫读和识别速度。 */
function PlatformMark({ id }: { id: HeroExampleId }) {
  if (id === "bedding") {
    return <UiIcon className="lp-platformLogo" icon={IconBrandTiktok} size="navigation" />;
  }
  if (id === "fashion") {
    return <UiIcon className="lp-platformLogo" icon={IconBrandAmazon} size="navigation" />;
  }
  return (
    <span aria-hidden="true" className="lp-platformLogo lp-platformLogo--temu">
      T
    </span>
  );
}

/** 在标题上方用移动取景框标示当前平台。 */
export function HeroPlatforms({
  active,
  onSelect,
}: {
  active: HeroExampleId;
  onSelect: (id: HeroExampleId) => void;
}) {
  const t = useMessages(showcaseMessages);
  const focusId = useId();
  const reducedMotion = useReducedMotion();
  return (
    <div className="lp-platformsWrap">
      <span className="lp-platformsLabel">{t.publishTo}</span>
      <ToggleButtonGroup
        aria-label={t.platforms}
        className="lp-platforms"
        disallowEmptySelection
        isDetached
        selectedKeys={[active]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [key] = keys;
          const example = examples.find(({ id }) => id === key);
          if (example) onSelect(example.id);
        }}
      >
        {examples.map(({ id, platform }) => (
          <ToggleButton
            className="lp-platform"
            data-platform={id}
            id={id}
            key={id}
            aria-label={platform}
          >
            {active === id && (
              <motion.span
                aria-hidden="true"
                className="lp-platformFocus"
                {...(reducedMotion ? {} : { layoutId: focusId })}
                transition={{ duration: 0.35 }}
              >
                <i />
                <i />
                <i />
                <i />
              </motion.span>
            )}
            <PlatformMark id={id} />
            <span className="lp-platformName">{platform}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

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
    <Popover onOpenChange={onInspect}>
      <Button aria-label={t.viewSales} className="lp-storeSales" variant="tertiary">
        <span>{t.demoData}</span>
        <strong>+{change}%</strong>
        <span>
          {t.orders} <UiIcon icon={IconArrowUp} size="small" />
        </span>
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
                <th scope="row">{t.visits}</th>
                <td>{example.visits[0]}</td>
                <td>{example.visits[1]}</td>
              </tr>
              <tr>
                <th scope="row">{t.orders}</th>
                <td>{example.orders[0]}</td>
                <td>{example.orders[1]}</td>
              </tr>
            </tbody>
          </table>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
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

function ShowcaseSlide({
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
export function HeroShowcase({
  active,
  onSelect,
}: {
  active: HeroExampleId;
  onSelect: (id: HeroExampleId) => void;
}) {
  const t = useMessages(showcaseMessages);
  const reducedMotion = useReducedMotion() ?? false;
  const [inspected, setInspected] = useState<HeroExampleId | null>(null);
  const { stageRef, inView } = useHeroPlayback();
  const example = examples.find(({ id }) => active === id) ?? examples[0];
  const playing = inspected !== active && !reducedMotion && inView;

  return (
    <section
      aria-label={t.showcase}
      className="lp-storeShowcase"
      data-playing={playing}
      ref={stageRef}
    >
      <ShowcaseSlide
        key={active}
        example={example}
        onInspect={(open) => setInspected(open ? active : null)}
      />
      <fieldset aria-label={t.platforms} className="lp-storeDots">
        {examples.map(({ id, platform }) => (
          <ToggleButton
            aria-label={platform}
            className="lp-storeDot"
            isSelected={active === id}
            key={id}
            onChange={() => onSelect(id)}
          >
            <span aria-hidden="true" className="lp-storeTrack">
              {active === id && (
                <span
                  className="lp-storeProgress"
                  onAnimationEnd={() => {
                    if (playing) onSelect(nextExample(active));
                  }}
                />
              )}
            </span>
          </ToggleButton>
        ))}
      </fieldset>
    </section>
  );
}
