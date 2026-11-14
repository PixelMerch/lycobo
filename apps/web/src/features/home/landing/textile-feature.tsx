import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { textileFeatureMessages } from "./textile-feature-messages";
import { TextileScrollBoard } from "./textile-scroll-board";
import { useCommerceScroll } from "./use-commerce-scroll";

const views = ["front", "pillow", "fabric", "bed-end"] as const;
const transition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;
const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 以滚动套图舞台与手动视角选择展示家纺用途，小屏保留直接浏览。 */
export function TextileFeature() {
  const t = useMessages(textileFeatureMessages);
  const reducedMotion = useReducedMotion();
  const story = useCommerceScroll();
  const [selected, setSelected] = useState<(typeof views)[number]>("front");
  const [open, setOpen] = useState(false);
  const images = [selected, ...views.filter((view) => view !== selected)].map((view) => ({
    src: `/studio/textile-views/${view}.webp`,
    alt: t.views[view].title,
  }));
  return (
    <section
      ref={story.target}
      data-scroll-story={story.enabled}
      className="commerce-textile"
      aria-labelledby="commerce-textile-title"
    >
      <div className="commerce-textile-pin">
        <div className="commerce-section">
          <div className="commerce-textile-heading">
            <h2 id="commerce-textile-title">{t.title}</h2>
            <div>
              <p>{t.description}</p>
              <RouteLink className="commerce-textile-action" to="/commerce/textile-set">
                {t.action}
                <UiIcon icon={IconArrowUpRight} />
              </RouteLink>
            </div>
          </div>
          {story.enabled ? (
            <TextileScrollBoard
              selected={selected}
              onOpen={() => setOpen(true)}
              progress={story.progress}
            />
          ) : (
            <TextileBoard selected={selected} onOpen={() => setOpen(true)} />
          )}
          <ToggleButtonGroup
            className="commerce-textile-tabs"
            aria-label={t.choose}
            selectedKeys={[selected]}
            selectionMode="single"
            disallowEmptySelection
            isDetached
            onSelectionChange={(keys) => {
              const next = views.find((view) => keys.has(view));
              if (next) setSelected(next);
            }}
          >
            {views.map((view) => (
              <ToggleButton id={view} key={view}>
                {t.views[view].title}
                {selected === view && (
                  <motion.span
                    className="commerce-textile-track"
                    layoutId="textile-track"
                    transition={reducedMotion ? { duration: 0 } : transition}
                  />
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <p
            id="commerce-textile-description"
            className="commerce-textile-current"
            aria-live="polite"
          >
            {t.views[selected].description}
          </p>
        </div>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}

/** 把主视角与三张局部照片组合成一个家纺摄影展台。 */
function TextileBoard({
  selected,
  onOpen,
}: {
  selected: (typeof views)[number];
  onOpen: () => void;
}) {
  const t = useMessages(textileFeatureMessages);
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="commerce-textile-board"
      initial="rest"
      whileInView="open"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="commerce-textile-main">
        <Button
          className="commerce-textile-image"
          variant="ghost"
          onPress={() => onOpen()}
          aria-label={t.open}
          aria-describedby="commerce-textile-description"
        >
          <motion.img
            key={selected}
            src={`/studio/textile-views/${selected}.webp`}
            alt={t.views[selected].title}
            loading="lazy"
            initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : transition}
          />
        </Button>
      </div>
      <div className="commerce-textile-details">
        {(["pillow", "fabric"] as const).map((view, index) => (
          <motion.figure
            key={view}
            variants={{
              rest: { opacity: 1, x: reducedMotion ? 0 : -32 },
              open: { opacity: 1, x: 0 },
            }}
            transition={reducedMotion ? { duration: 0 } : { ...transition, delay: index * 0.08 }}
          >
            <img
              src={`/studio/textile-views/${view}.webp`}
              alt={t.views[view].title}
              loading="lazy"
            />
            <figcaption>{t.views[view].title}</figcaption>
          </motion.figure>
        ))}
      </div>
      <div className="commerce-textile-note">
        <img
          src="/studio/textile-views/bed-end.webp"
          alt={t.views["bed-end"].title}
          loading="lazy"
        />
        <h3>{t.views["bed-end"].title}</h3>
        <p>{t.views["bed-end"].description}</p>
      </div>
    </motion.div>
  );
}
