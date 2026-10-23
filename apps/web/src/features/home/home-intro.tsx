import { AnimatePresence, type MotionStyle, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { homeIntro } from "./home-intro-config";

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
type CharacterStyle = MotionStyle & { "--character-offset": string };

// Focused adaptation of React Bits Gradient Text / Rotating Text character flip effects.
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
  const characters = Array.from(segmenter.segment(current.text), (part) => ({
    text: part.segment,
    offset: part.index,
  }));
  return (
    <div className="home-intro" ref={root}>
      <span className="sr-only">{homeIntro.phrases[0].text}</span>
      <span className="home-intro-rotation" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={current.text}
            className="home-intro-phrase"
            data-palette={current.palette}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {reduced ? (
              <span className="home-intro-gradient">{current.text}</span>
            ) : (
              characters.map((character, characterIndex) => {
                const delay = characterIndex * homeIntro.staggerDuration;
                const style: CharacterStyle = {
                  "--character-offset": `${(characterIndex / Math.max(1, characters.length - 1)) * 100}%`,
                };
                return (
                  <motion.span
                    key={`${current.text}-${character.offset}`}
                    className="home-intro-character home-intro-gradient"
                    style={style}
                    variants={{
                      initial: { rotateX: -90, opacity: 0, filter: `blur(${homeIntro.blur}px)` },
                      animate: { rotateX: 0, opacity: 1, filter: "blur(0px)" },
                      exit: {
                        rotateX: 90,
                        opacity: 0,
                        filter: `blur(${homeIntro.blur}px)`,
                        transition: { duration: 0.25, ease: "easeIn", delay },
                      },
                    }}
                    transition={{ type: "spring", ...homeIntro.spring, delay }}
                  >
                    {character.text}
                  </motion.span>
                );
              })
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}
