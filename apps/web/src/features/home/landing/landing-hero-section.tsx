import { Button } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { shellMessages } from "../../../app/shell-messages";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { dashboardPath, dashboardToolPaths } from "../../../lib/dashboard-paths";
import { LandingActionLink } from "./landing-action-link";
import { landingHeroMessages } from "./landing-hero-messages";
import { landingEase, landingTextReveal, landingTextSequence } from "./landing-motion";
import "./landing-hero-section.css";

interface HeroPanel {
  id: string;
  image: string;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
}

interface HeroAccordionPanelProps {
  panel: HeroPanel;
  isActive: boolean;
  onActivate: () => void;
  reducedMotion: boolean;
}

function HeroAccordionPanel({
  panel,
  isActive,
  onActivate,
  reducedMotion,
}: HeroAccordionPanelProps) {
  return (
    <motion.article
      className="lp-hero-panel"
      data-active={isActive ? "true" : "false"}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      layout={!reducedMotion}
      transition={{ duration: 0.58, ease: landingEase }}
    >
      <img
        src={panel.image}
        alt={panel.title}
        className="lp-hero-panel-img"
        decoding="async"
        fetchPriority={isActive ? "high" : "auto"}
      />
      <div className="lp-hero-panel-scrim" aria-hidden="true" />

      {!isActive ? (
        <Button
          variant="ghost"
          aria-label={panel.title}
          className="lp-hero-panel-trigger"
          onPress={onActivate}
        />
      ) : null}

      <div className="lp-hero-panel-body">
        <h3 className="lp-hero-panel-title">{panel.title}</h3>
        <AnimatePresence initial={false}>
          {isActive ? (
            <motion.div
              key={`${panel.id}-details`}
              className="lp-hero-panel-details"
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }}
              transition={{ duration: 0.34, ease: landingEase }}
            >
              <p className="lp-hero-panel-desc">{panel.description}</p>
              <RouteLink to={panel.to} className="lp-hero-panel-cta">
                {panel.actionLabel}
                <UiIcon icon={IconArrowUpRight} size="small" />
              </RouteLink>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

const heroLogos = [
  { id: "futurebrand", src: "/landing/ltx/logos/futurebrand.svg", alt: "FutureBrand" },
  { id: "cylndr", src: "/landing/ltx/logos/cylndr.svg", alt: "CYLNDR" },
  { id: "code-and-theory", src: "/landing/ltx/logos/code-and-theory.svg", alt: "Code and Theory" },
  { id: "trapdoor", src: "/landing/ltx/logos/trapdoor.png", alt: "Trapdoor Creative" },
  { id: "mccann", src: "/landing/ltx/logos/mccann.png", alt: "McCann Worldgroup" },
  { id: "elevenlabs", src: "/landing/ltx/logos/elevenlabs.svg", alt: "ElevenLabs" },
  { id: "clutch", src: "/landing/ltx/logos/clutch.svg", alt: "Clutch" },
];

function HeroLogoMarquee({ reducedMotion }: { reducedMotion: boolean }) {
  const items = reducedMotion
    ? heroLogos.map((logo) => ({ ...logo, key: `${logo.id}-a`, duplicate: false }))
    : [
        ...heroLogos.map((logo) => ({ ...logo, key: `${logo.id}-a`, duplicate: false })),
        ...heroLogos.map((logo) => ({ ...logo, key: `${logo.id}-b`, duplicate: true })),
      ];

  return (
    <div className="lp-logo-marquee">
      <div className="lp-logo-track" data-static={reducedMotion ? "true" : "false"}>
        {items.map((logo) => (
          <img
            key={logo.key}
            src={logo.src}
            alt={logo.duplicate ? "" : logo.alt}
            aria-hidden={logo.duplicate ? true : undefined}
            className="lp-logo-item"
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}

/** 首页复刻 LTX 首屏大标题、锐利白底主按钮、全幅横向手风琴画廊与滚动品牌标带。 */
export function LandingHeroSection() {
  const t = useMessages(landingHeroMessages);
  const { startCreating } = useMessages(shellMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [activeId, setActiveId] = useState("hero-2");

  const panels: HeroPanel[] = [
    {
      id: "hero-1",
      image: "/landing/ltx/hero-1.avif",
      title: t.cardOneTitle,
      description: t.cardOneDesc,
      actionLabel: t.cardOneAction,
      to: dashboardToolPaths.create,
    },
    {
      id: "hero-2",
      image: "/landing/ltx/hero-2.webp",
      title: t.cardTwoTitle,
      description: t.cardTwoDesc,
      actionLabel: t.cardTwoAction,
      to: dashboardToolPaths.variation,
    },
    {
      id: "hero-3",
      image: "/landing/ltx/hero-3.webp",
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
        <div className="lp-hero-accordion">
          {panels.map((panel) => (
            <HeroAccordionPanel
              key={panel.id}
              panel={panel}
              isActive={panel.id === activeId}
              onActivate={() => setActiveId(panel.id)}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </motion.div>

      <HeroLogoMarquee reducedMotion={reducedMotion} />
    </section>
  );
}
