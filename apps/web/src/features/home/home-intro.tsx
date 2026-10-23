import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { homeIntro } from "./home-intro-config";

// Focused adaptation of React Bits Gradient Text / Rotating Text effects.
// Source and license: docs/third-party.md and docs/licenses/react-bits.md.
export function HomeIntro() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (reduced || !element) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let hovered = false;
    const pause = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const resume = () => {
      pause();
      if (document.hidden || hovered) return;
      timer = setInterval(() => {
        setIndex((current) => (current + 1) % homeIntro.phrases.length);
      }, homeIntro.interval);
    };
    const enter = () => {
      hovered = true;
      pause();
    };
    const leave = () => {
      hovered = false;
      resume();
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", resume);
    resume();
    return () => {
      pause();
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [reduced]);
  const current = reduced
    ? homeIntro.phrases[0]
    : (homeIntro.phrases[index] ?? homeIntro.phrases[0]);
  return (
    <div className="home-intro" ref={root}>
      <span className="sr-only">
        {homeIntro.prefix}，{homeIntro.phrases[0]}
      </span>
      <span className="home-intro-prefix" aria-hidden="true">
        {homeIntro.prefix}
      </span>
      <span className="home-intro-rotation" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={current}
            className="home-intro-phrase home-intro-gradient"
            initial={reduced ? false : { y: "70%", rotateX: -35, opacity: 0 }}
            animate={{ y: 0, rotateX: 0, opacity: 1 }}
            exit={reduced ? { opacity: 1 } : { y: "-70%", rotateX: 35, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {current}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}
