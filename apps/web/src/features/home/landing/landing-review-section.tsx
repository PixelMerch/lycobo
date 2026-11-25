import { useReducedMotion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { publicImageUrl } from "../../../lib/public-image-url";
import { inspirationLibraryPath } from "../../inspiration/inspiration-path";
import { LandingActionLink } from "./landing-action-link";
import { landingReviewMessages } from "./landing-review-messages";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-review-section.css";

interface ShowcaseFrame {
  id: string;
  image: string;
  caption: string;
}

/** 展示按商品摄影题材策划的灵感案例，并提供进入灵感库的入口。 */
export function LandingReviewSection() {
  const t = useMessages(landingReviewMessages);
  const reducedMotion = Boolean(useReducedMotion());

  const frames: ShowcaseFrame[] = [
    {
      id: "show-1",
      image: publicImageUrl("/landing/examples/show-clean.webp"),
      caption: t.shotOne,
    },
    {
      id: "show-2",
      image: publicImageUrl("/landing/examples/show-sport.webp"),
      caption: t.shotTwo,
    },
    {
      id: "show-3",
      image: publicImageUrl("/landing/examples/show-model.webp"),
      caption: t.shotThree,
    },
    {
      id: "show-4",
      image: publicImageUrl("/landing/examples/show-detail.webp"),
      caption: t.shotFour,
    },
    {
      id: "show-5",
      image: publicImageUrl("/landing/examples/show-contrast.webp"),
      caption: t.shotFive,
    },
    {
      id: "show-6",
      image: publicImageUrl("/landing/examples/show-outdoors.webp"),
      caption: t.shotSix,
    },
  ];

  const loopFrames = reducedMotion
    ? frames.map((frame) => ({ ...frame, key: `${frame.id}-primary`, duplicate: false }))
    : [
        ...frames.map((frame) => ({ ...frame, key: `${frame.id}-primary`, duplicate: false })),
        ...frames.map((frame) => ({ ...frame, key: `${frame.id}-clone`, duplicate: true })),
      ];

  return (
    <section className="lp-showcase" aria-labelledby="lp-showcase-title">
      <div className="lp-container">
        <div className="lp-showcase-head">
          <LandingSectionHeading
            id="lp-showcase-title"
            className="lp-showcase-copy"
            title={t.title}
            description={t.subtitle}
          />
          <LandingActionLink to={inspirationLibraryPath} variant="secondary">
            {t.action}
          </LandingActionLink>
        </div>
      </div>

      <div className="lp-marquee">
        <div className="lp-marquee-track" data-static={reducedMotion ? "true" : "false"}>
          {loopFrames.map((frame) => (
            <figure
              key={frame.key}
              className="lp-marquee-card"
              aria-hidden={frame.duplicate ? true : undefined}
            >
              <img
                src={frame.image}
                alt={frame.duplicate ? "" : frame.caption}
                className="lp-marquee-img"
                loading="lazy"
                decoding="async"
              />
              <div className="lp-marquee-scrim" aria-hidden="true" />
              <figcaption className="lp-marquee-caption">{frame.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
