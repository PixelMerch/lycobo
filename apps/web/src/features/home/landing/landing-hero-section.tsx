import { Button } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { shellMessages } from "../../../app/shell-messages";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { dashboardPath, dashboardToolPaths } from "../../../lib/dashboard-paths";
import { publicImageUrl } from "../../../lib/public-image-url";
import { LandingActionLink } from "./landing-action-link";
import { landingHeroMessages } from "./landing-hero-messages";
import { landingEase, landingTextReveal, landingTextSequence } from "./landing-motion";
import "./landing-hero-section.css";

interface HeroPanel {
  id: string;
  image: string;
  imageAlt: string;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
}

interface HeroAccordionPanelProps {
  panel: HeroPanel;
  isActive: boolean;
  onHover: () => void;
  onToggle: () => void;
  reducedMotion: boolean;
}

/** 展示单个商品案例，展开后提供说明和对应的创作入口。 */
function HeroAccordionPanel({
  panel,
  isActive,
  onHover,
  onToggle,
  reducedMotion,
}: HeroAccordionPanelProps) {
  const detailsId = `lp-${panel.id}-details`;
  return (
    <article
      className="lp-hero-panel"
      data-active={isActive ? "true" : "false"}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover();
      }}
    >
      <img
        src={panel.image}
        alt={panel.imageAlt}
        className="lp-hero-panel-img"
        decoding="async"
        fetchPriority={panel.id === "hero-1" ? "high" : "auto"}
      />
      <div className="lp-hero-panel-scrim" aria-hidden="true" />

      <Button
        variant="ghost"
        aria-label={panel.title}
        aria-expanded={isActive}
        aria-controls={detailsId}
        className="lp-hero-panel-trigger"
        onPress={(event) => {
          if (event.pointerType === "mouse") onHover();
          else onToggle();
        }}
      />

      <div className="lp-hero-panel-body">
        <h3 className="lp-hero-panel-title">{panel.title}</h3>
        <div id={detailsId} className="lp-hero-detail-region" inert={!isActive}>
          <AnimatePresence initial={false}>
            {isActive && (
              <motion.div
                className="lp-hero-panel-details"
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                transition={{ duration: reducedMotion ? 0 : 0.34, ease: landingEase }}
              >
                <p className="lp-hero-panel-desc">{panel.description}</p>
                <RouteLink to={panel.to} className="lp-hero-panel-cta">
                  {panel.actionLabel}
                  <UiIcon icon={IconArrowUpRight} size="small" />
                </RouteLink>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

/** 首页首屏展示三组自制商品案例，并从画廊直达对应创作工具。 */
export function LandingHeroSection() {
  const t = useMessages(landingHeroMessages);
  const { startCreating } = useMessages(shellMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const activeId = pressedId ?? hoveredId;

  const panels: HeroPanel[] = [
    {
      id: "hero-1",
      image: publicImageUrl("/landing/hero/camera-studio.webp"),
      imageAlt: t.cardOneImageAlt,
      title: t.cardOneTitle,
      description: t.cardOneDesc,
      actionLabel: t.cardOneAction,
      to: dashboardToolPaths.create,
    },
    {
      id: "hero-2",
      image: publicImageUrl("/landing/hero/amber-serum-set.webp"),
      imageAlt: t.cardTwoImageAlt,
      title: t.cardTwoTitle,
      description: t.cardTwoDesc,
      actionLabel: t.cardTwoAction,
      to: dashboardToolPaths.variation,
    },
    {
      id: "hero-3",
      image: publicImageUrl("/landing/hero/bronze-eyewear-editorial.webp"),
      imageAlt: t.cardThreeImageAlt,
      title: t.cardThreeTitle,
      description: t.cardThreeDesc,
      actionLabel: t.cardThreeAction,
      to: dashboardToolPaths.replica,
    },
  ];

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-container">
        <motion.div
          className="lp-hero-head"
          variants={landingTextSequence}
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
        >
          <h1 id="lp-hero-title" className="lp-hero-title">
            <motion.span className="lp-hero-line" variants={landingTextReveal}>
              {t.titleLineOne}
            </motion.span>
            <motion.span className="lp-hero-line lp-gradient-text" variants={landingTextReveal}>
              {t.titleLineTwo}
            </motion.span>
          </h1>

          <motion.p className="lp-hero-subtitle" variants={landingTextReveal}>
            {t.subtitle}
          </motion.p>

          <motion.div className="lp-hero-actions" variants={landingTextReveal}>
            <LandingActionLink to={dashboardPath}>{startCreating}</LandingActionLink>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="lp-hero-stage"
        initial={reducedMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.22, ease: landingEase }}
      >
        <fieldset
          className="lp-hero-accordion"
          aria-labelledby="lp-hero-title"
          data-expanded={activeId !== null}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setHoveredId(null);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPressedId(null);
          }}
        >
          {panels.map((panel) => (
            <HeroAccordionPanel
              key={panel.id}
              panel={panel}
              isActive={panel.id === activeId}
              onHover={() => setHoveredId(panel.id)}
              onToggle={() => {
                setHoveredId(null);
                setPressedId(activeId === panel.id ? null : panel.id);
              }}
              reducedMotion={reducedMotion}
            />
          ))}
        </fieldset>
      </motion.div>
    </section>
  );
}
