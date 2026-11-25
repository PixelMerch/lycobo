import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { publicImageUrl } from "../../../lib/public-image-url";
import { landingCapabilityMessages } from "./landing-capability-messages";
import { landingDemoMessages } from "./landing-demo-messages";
import { landingImageSetExamples } from "./landing-example-assets";
import { landingEase } from "./landing-motion";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-demo-section.css";

const productionTabOrder: readonly string[] = ["storyboard", "canvas", "prompt"];

interface ProductionTab {
  id: string;
  title: string;
  description: string;
  images: { src: string; caption: string }[];
  prompts?: { label: string; text: string }[];
}

/** 用实际的商品图示例讲解套图计划、自由画布和提示词优化。 */
export function LandingDemoSection() {
  const t = useMessages(landingDemoMessages);
  const examples = useMessages(landingCapabilityMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [activeId, setActiveId] = useState("storyboard");
  const [paused, setPaused] = useState(false);

  const tabs: ProductionTab[] = [
    {
      id: "storyboard",
      title: t.tabOneTitle,
      description: t.tabOneDesc,
      images: landingImageSetExamples.map(({ image, titleKey }) => ({
        src: image,
        caption: examples[titleKey],
      })),
    },
    {
      id: "canvas",
      title: t.tabTwoTitle,
      description: t.tabTwoDesc,
      images: [
        {
          src: publicImageUrl("/landing/examples/main-reference.webp"),
          caption: t.productReference,
        },
        { src: publicImageUrl("/landing/examples/main-studio.webp"), caption: t.studioResult },
      ],
    },
    {
      id: "prompt",
      title: t.tabThreeTitle,
      description: t.tabThreeDesc,
      images: [
        { src: publicImageUrl("/landing/examples/main-studio.webp"), caption: t.studioResult },
      ],
      prompts: [
        { label: t.promptBeforeLabel, text: t.promptBeforeText },
        { label: t.promptAfterLabel, text: t.promptAfterText },
      ],
    },
  ];

  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const currentIndex = productionTabOrder.indexOf(prev);
        return productionTabOrder[(currentIndex + 1) % productionTabOrder.length] ?? "storyboard";
      });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  if (!activeTab) return null;

  return (
    <section className="lp-console" aria-labelledby="lp-console-title">
      <div className="lp-container">
        <LandingSectionHeading
          id="lp-console-title"
          title={t.sectionTitle}
          description={t.sectionSubtitle}
        />

        <div className="lp-console-grid">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([activeId])}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              if (typeof selected === "string") {
                setPaused(true);
                setActiveId(selected);
              }
            }}
            aria-label={t.tabsAriaLabel}
            className="lp-console-tabs"
          >
            {tabs.map((tab) => {
              const isSelected = tab.id === activeId;
              return (
                <ToggleButton key={tab.id} id={tab.id} className="lp-console-tab">
                  <span className="lp-console-tab-bar" aria-hidden="true">
                    {isSelected ? (
                      <motion.span
                        layoutId="lp-console-active-bar"
                        className="lp-console-tab-bar-fill"
                        transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      />
                    ) : null}
                  </span>
                  <span className="lp-console-tab-copy">
                    <span className="lp-console-tab-title">{tab.title}</span>
                    <span className="lp-console-tab-desc">{tab.description}</span>
                  </span>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <div className="lp-console-stage lp-glow-frame">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                className="lp-console-preview"
                data-preview={activeTab.id}
                initial={reducedMotion ? false : { opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: reducedMotion ? 1 : 0 }}
                transition={{ duration: 0.38, ease: landingEase }}
              >
                {activeTab.prompts && (
                  <dl className="lp-console-prompts">
                    {activeTab.prompts.map(({ label, text }) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {activeTab.images.map(({ src, caption }) => (
                  <figure key={src} className="lp-console-example">
                    <img src={src} alt="" loading="lazy" decoding="async" />
                    <figcaption>{caption}</figcaption>
                  </figure>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
