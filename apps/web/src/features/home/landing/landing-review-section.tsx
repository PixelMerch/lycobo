import { useReducedMotion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
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

/** 首页复刻 LTX 宽银幕横向无缝滚动成片展示带，悬停自动暂停并可直达灵感库。 */
export function LandingReviewSection() {
  const t = useMessages(landingReviewMessages);
  const reducedMotion = Boolean(useReducedMotion());

  const frames: ShowcaseFrame[] = [
    { id: "show-1", image: "/landing/ltx/show-1.avif", caption: t.shotOne },
    { id: "show-2", image: "/landing/ltx/show-2.avif", caption: t.shotTwo },
    { id: "show-3", image: "/landing/ltx/show-3.avif", caption: t.shotThree },
    { id: "show-4", image: "/landing/ltx/show-4.avif", caption: t.shotFour },
    { id: "show-5", image: "/landing/ltx/show-5.avif", caption: t.shotFive },
    { id: "show-6", image: "/landing/ltx/show-6.avif", caption: t.shotSix },
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
