import { motion, useReducedMotion } from "motion/react";
import { landingTextReveal, landingTextSequence, landingViewport } from "./landing-motion";

/** 区块标题与说明共用一次入场动画，FAQ 标题可接收导航焦点。 */
export function LandingSectionHeading({
  id,
  title,
  description,
  className = "lp-section-head",
  titleClassName = "lp-section-title",
  tabIndex,
}: {
  id: string;
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  tabIndex?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.header
      className={className}
      variants={landingTextSequence}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={landingViewport}
    >
      <motion.h2
        id={id}
        className={titleClassName}
        tabIndex={tabIndex}
        variants={landingTextReveal}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p className="lp-section-description" variants={landingTextReveal}>
          {description}
        </motion.p>
      )}
    </motion.header>
  );
}
