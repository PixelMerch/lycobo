import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";
import "./commerce-intro.css";

const views = ["original", "studio", "scene", "detail"] as const;
const scrollMedia = "(min-height: 560px) and (prefers-reduced-motion: no-preference)";

/** 垂直滚动依次带过同款商品的四张横幅，再接回正文。 */
export function ProductIntro() {
  const { intro, shots } = useMessages(commerceShowcaseMessages);
  const section = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start 72px", "end end"] });
  const x = useTransform(scrollYProgress, [0, 0.06, 0.94, 1], [0, 0, -travel, -travel]);

  useEffect(() => {
    const viewport = windowRef.current;
    const track = rail.current;
    if (!viewport || !track) return;
    const media = window.matchMedia(scrollMedia);
    const measure = () => {
      setTravel(media.matches ? Math.max(0, track.scrollWidth - viewport.clientWidth) : 0);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    media.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
    };
  }, []);

  const scrollable = travel > 0;

  return (
    <section
      ref={section}
      className="commerce-intro"
      aria-labelledby="commerce-intro-title"
      style={scrollable ? { minHeight: `calc(100svh + ${Math.round(travel * 0.72)}px)` } : {}}
    >
      <div className="commerce-intro-sticky">
        <div className="commerce-section commerce-intro-copy">
          <h2 id="commerce-intro-title">{intro.title}</h2>
        </div>
        <div ref={windowRef} className="commerce-intro-window">
          <motion.div ref={rail} className="commerce-intro-rail" style={{ x }}>
            {views.map((view) => (
              <figure key={view}>
                <ProductFrame view={view} />
                <figcaption>{shots[view]}</figcaption>
              </figure>
            ))}
          </motion.div>
        </div>
        <div className="commerce-section commerce-intro-progress" aria-hidden="true">
          <motion.span style={{ scaleX: scrollYProgress }} />
        </div>
      </div>
    </section>
  );
}
