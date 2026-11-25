import { motion, useReducedMotion } from "motion/react";
import { shellMessages } from "../../../app/shell-messages";
import { useMessages } from "../../../i18n/messages";
import { dashboardPath } from "../../../lib/dashboard-paths";
import { publicImageUrl } from "../../../lib/public-image-url";
import { inspirationLibraryPath } from "../../inspiration/inspiration-path";
import { LandingActionLink } from "./landing-action-link";
import { landingClosingMessages } from "./landing-closing-messages";
import { landingEase, landingViewport } from "./landing-motion";
import "./landing-closing-section.css";

/** 用暗色摄影背景承托首页底部的创作与灵感入口。 */
export function LandingClosingSection() {
  const t = useMessages(landingClosingMessages);
  const { startCreating } = useMessages(shellMessages);
  const reducedMotion = useReducedMotion();

  return (
    <section className="lp-closing" aria-labelledby="lp-closing-title">
      <div className="lp-container">
        <motion.div
          className="lp-closing-stage"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={landingViewport}
          transition={{ duration: 0.7, ease: landingEase }}
        >
          <img
            src={publicImageUrl("/landing/examples/closing-studio.webp")}
            alt=""
            aria-hidden="true"
            className="lp-closing-bg"
            loading="lazy"
            decoding="async"
          />
          <div className="lp-closing-scrim" aria-hidden="true" />
          <div className="lp-closing-content">
            <h2 id="lp-closing-title" className="lp-closing-title">
              {t.title}
            </h2>
            <div className="lp-closing-actions">
              <LandingActionLink to={dashboardPath}>{startCreating}</LandingActionLink>
              <LandingActionLink to={inspirationLibraryPath} variant="secondary" showArrow={false}>
                {t.secondaryAction}
              </LandingActionLink>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
