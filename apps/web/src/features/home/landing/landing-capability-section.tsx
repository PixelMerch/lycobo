import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { dashboardToolPaths } from "../../../lib/dashboard-paths";
import { LandingActionLink } from "./landing-action-link";
import { landingCapabilityMessages } from "./landing-capability-messages";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-capability-section.css";

interface VisualCard {
  id: string;
  image: string;
  title: string;
}

interface BandHeaderProps {
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
}

function CapabilityBandHeader({ title, description, actionLabel, actionTo }: BandHeaderProps) {
  return (
    <div className="lp-band-head">
      <div className="lp-band-copy">
        <h3 className="lp-band-title">{title}</h3>
        <p className="lp-band-desc">{description}</p>
      </div>
      <LandingActionLink to={actionTo}>{actionLabel}</LandingActionLink>
    </div>
  );
}

interface GridBandProps {
  cards: VisualCard[];
  onMediaHover: (active: boolean) => void;
}

function CapabilityGridBand({ cards, onMediaHover }: GridBandProps) {
  return (
    <div className="lp-band-grid" data-columns={cards.length}>
      {cards.map((card) => (
        <figure
          key={card.id}
          className="lp-band-card"
          onMouseEnter={() => onMediaHover(true)}
          onMouseLeave={() => onMediaHover(false)}
        >
          <div className="lp-band-media">
            <img
              src={card.image}
              alt={card.title}
              className="lp-band-img"
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption className="lp-band-caption">{card.title}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** 首页复刻 LTX 滚动粘性层叠卡片（GEN SPACE → CONTROL → STYLE → ELEMENTS）与圆形跟随光标。 */
export function LandingCapabilitySection() {
  const t = useMessages(landingCapabilityMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorExpanded, setCursorExpanded] = useState(false);

  const mouseX = useMotionValue(-120);
  const mouseY = useMotionValue(-120);
  const cursorX = useSpring(mouseX, { stiffness: 420, damping: 34, mass: 0.5 });
  const cursorY = useSpring(mouseY, { stiffness: 420, damping: 34, mass: 0.5 });

  const genCards: VisualCard[] = [
    { id: "gen-1", image: "/landing/ltx/gen-1.avif", title: t.genOneTitle },
    { id: "gen-2", image: "/landing/ltx/gen-2.webp", title: t.genTwoTitle },
    { id: "gen-3", image: "/landing/ltx/gen-3.webp", title: t.genThreeTitle },
    { id: "gen-4", image: "/landing/ltx/gen-4.webp", title: t.genFourTitle },
  ];

  const controlCards: VisualCard[] = [
    { id: "ctrl-1", image: "/landing/ltx/ctrl-1.webp", title: t.ctrlOneTitle },
    { id: "ctrl-2", image: "/landing/ltx/ctrl-2.webp", title: t.ctrlTwoTitle },
    { id: "ctrl-3", image: "/landing/ltx/ctrl-3.webp", title: t.ctrlThreeTitle },
  ];

  const elementCards: VisualCard[] = [
    { id: "elem-1", image: "/landing/ltx/elem-1.webp", title: t.elemOneTitle },
    { id: "elem-2", image: "/landing/ltx/elem-2.webp", title: t.elemTwoTitle },
    { id: "elem-3", image: "/landing/ltx/elem-3.webp", title: t.elemThreeTitle },
  ];

  const bands: (BandHeaderProps & { cards?: VisualCard[] })[] = [
    {
      title: t.bandOneTitle,
      description: t.bandOneDescription,
      actionLabel: t.bandOneAction,
      actionTo: dashboardToolPaths.create,
      cards: genCards,
    },
    {
      title: t.bandTwoTitle,
      description: t.bandTwoDescription,
      actionLabel: t.bandTwoAction,
      actionTo: dashboardToolPaths.variation,
      cards: controlCards,
    },
    {
      title: t.bandThreeTitle,
      description: t.bandThreeDescription,
      actionLabel: t.bandThreeAction,
      actionTo: dashboardToolPaths.replica,
    },
    {
      title: t.bandFourTitle,
      description: t.bandFourDescription,
      actionLabel: t.bandFourAction,
      actionTo: dashboardToolPaths.textile,
      cards: elementCards,
    },
  ];

  return (
    <section
      className="lp-cap"
      aria-labelledby="lp-cap-title"
      onMouseMove={(event) => {
        if (reducedMotion) return;
        mouseX.set(event.clientX);
        mouseY.set(event.clientY);
        if (!cursorVisible) setCursorVisible(true);
      }}
      onMouseLeave={() => {
        setCursorVisible(false);
        setCursorExpanded(false);
      }}
    >
      {!reducedMotion ? (
        <motion.div
          className="lp-float-cursor"
          data-visible={cursorVisible ? "true" : "false"}
          data-expanded={cursorExpanded ? "true" : "false"}
          style={{ x: cursorX, y: cursorY }}
          aria-hidden="true"
        >
          <span>{t.cursorLabel}</span>
        </motion.div>
      ) : null}

      <div className="lp-container">
        <LandingSectionHeading
          className="lp-cap-intro"
          id="lp-cap-title"
          titleClassName="lp-cap-mega-title"
          title={t.sectionTitle}
          description={t.sectionSubtitle}
        />

        <div className="lp-stack-deck">
          {bands.map(({ cards, ...header }, index) => (
            <div className="lp-stack-card" key={header.actionTo} data-step={index + 1}>
              <CapabilityBandHeader {...header} />
              {cards ? (
                <CapabilityGridBand cards={cards} onMediaHover={setCursorExpanded} />
              ) : (
                <figure
                  className="lp-style-banner-shell"
                  onMouseEnter={() => setCursorExpanded(true)}
                  onMouseLeave={() => setCursorExpanded(false)}
                >
                  <img
                    src="/landing/ltx/style-banner.webp"
                    alt={t.styleBannerAlt}
                    className="lp-style-banner-img"
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
