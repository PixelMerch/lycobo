import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { dashboardToolPaths } from "../../../lib/dashboard-paths";
import { publicImageUrl } from "../../../lib/public-image-url";
import { LandingActionLink } from "./landing-action-link";
import { landingCapabilityMessages } from "./landing-capability-messages";
import { landingImageSetExamples } from "./landing-example-assets";
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

/** 展示风格匹配的前后示例。 */
function StyleComparison({ onMediaHover }: Pick<GridBandProps, "onMediaHover">) {
  const t = useMessages(landingCapabilityMessages);
  return (
    <figure
      className="lp-style-banner-shell"
      onMouseEnter={() => onMediaHover(true)}
      onMouseLeave={() => onMediaHover(false)}
    >
      <img
        src={publicImageUrl("/landing/examples/lamp-style-comparison.webp")}
        alt={t.styleBannerAlt}
        className="lp-style-banner-img"
        loading="lazy"
        decoding="async"
      />
      <figcaption className="lp-style-banner-labels">
        <span>{t.styleBefore}</span>
        <span>{t.styleAfter}</span>
      </figcaption>
    </figure>
  );
}

/** 用商品、风格和床品示例展示各创作工具的可用场景。 */
export function LandingCapabilitySection() {
  const t = useMessages(landingCapabilityMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorExpanded, setCursorExpanded] = useState(false);

  const mouseX = useMotionValue(-120);
  const mouseY = useMotionValue(-120);
  const cursorX = useSpring(mouseX, { stiffness: 420, damping: 34, mass: 0.5 });
  const cursorY = useSpring(mouseY, { stiffness: 420, damping: 34, mass: 0.5 });

  const productCards: VisualCard[] = [
    {
      id: "espresso",
      image: publicImageUrl("/landing/examples/product-espresso.webp"),
      title: t.productStudioTitle,
    },
    {
      id: "bag",
      image: publicImageUrl("/landing/examples/product-bag-model.webp"),
      title: t.productModelTitle,
    },
    {
      id: "skincare",
      image: publicImageUrl("/landing/examples/product-skincare-detail.webp"),
      title: t.productDetailTitle,
    },
    {
      id: "runner",
      image: publicImageUrl("/landing/examples/product-runner-campaign.webp"),
      title: t.productCampaignTitle,
    },
  ];

  const setCards = landingImageSetExamples.map(({ id, image, titleKey }) => ({
    id,
    image,
    title: t[titleKey],
  }));

  const elementCards: VisualCard[] = [
    {
      id: "elem-1",
      image: publicImageUrl("/landing/examples/navy-bedding-room.webp"),
      title: t.elemOneTitle,
    },
    {
      id: "elem-2",
      image: publicImageUrl("/landing/examples/navy-bedding-overhead.webp"),
      title: t.elemTwoTitle,
    },
    {
      id: "elem-3",
      image: publicImageUrl("/landing/examples/navy-bedding-weave.webp"),
      title: t.elemThreeTitle,
    },
  ];

  const bands: (BandHeaderProps & { cards?: VisualCard[] })[] = [
    {
      title: t.bandOneTitle,
      description: t.bandOneDescription,
      actionLabel: t.bandOneAction,
      actionTo: dashboardToolPaths.create,
      cards: productCards,
    },
    {
      title: t.bandTwoTitle,
      description: t.bandTwoDescription,
      actionLabel: t.bandTwoAction,
      actionTo: dashboardToolPaths.variation,
      cards: setCards,
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
                <StyleComparison onMediaHover={setCursorExpanded} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
