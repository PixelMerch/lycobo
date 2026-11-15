import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { ShowcaseSlide } from "./hero-showcase-cards";
import { examples, type HeroExampleId, nextExample } from "./hero-showcase-data";
import { showcaseMessages } from "./hero-showcase-messages";
import { useHeroPlayback } from "./use-hero-playback";

export type { HeroExampleId } from "./hero-showcase-data";

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
        {examples.map(({ id, platform, logo }) => (
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
            <img alt="" className="lp-platformLogo" src={logo} width="20" height="20" />
            <span className="lp-platformName">{platform}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

/** 展示商品成片、平台预览、演示数据与自动轮播入口。 */
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
