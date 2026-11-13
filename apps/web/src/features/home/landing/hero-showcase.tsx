import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowDown } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { showcaseMessages } from "./hero-showcase-messages";
import { useHeroPlayback } from "./use-hero-playback";

const examples = [
  { id: "fashion", platform: "TikTok Shop", orders: [24, 32], visits: [1200, 1280] },
  { id: "audio", platform: "Amazon", orders: [40, 49], visits: [1600, 1750] },
  { id: "bedding", platform: "Temu", orders: [31, 39], visits: [1550, 1560] },
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
        <ToggleButton className="lp-platform" id={id} key={id}>
          {active === id && (
            <motion.span
              aria-hidden="true"
              className="lp-platformFocus"
              {...(reducedMotion ? {} : { layoutId: focusId })}
              transition={{ duration: 0.35 }}
            />
          )}
          {platform}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
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
          {t.orders} <UiIcon icon={IconArrowDown} size="small" />
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
        <figcaption>
          <strong>{copy.name}</strong>
          <span>{copy.format}</span>
        </figcaption>
      </figure>
      <div className="lp-storeOutput">
        <img alt="" src={exampleImage(example.id, "after")} width="720" height="960" />
        <span>{copy.preview}</span>
      </div>
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
