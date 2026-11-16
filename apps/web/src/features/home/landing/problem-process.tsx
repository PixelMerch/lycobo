import { motion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { processMessages } from "./process-messages";
import { ProductFrame } from "./product-frame";
import { ProductProcessStage } from "./product-process-stage";
import { useShowcaseScroll } from "./use-showcase-scroll";
import "./commerce-process.css";

const scrollMedia = "(min-height: 560px) and (prefers-reduced-motion: no-preference)";
const views = ["original", "studio", "scene", "detail"] as const;

/** 画面随滚动推进，减少动态效果时按顺序展示静态图。 */
export function ProblemProcess() {
  const t = useMessages(processMessages);
  const { shots } = useMessages(commerceShowcaseMessages);
  const chapter = useShowcaseScroll(views.length, scrollMedia);
  const current = views[chapter.active] ?? views[0];

  return (
    <section
      ref={chapter.section}
      id="problem-and-workflow"
      className="commerce-process"
      aria-labelledby="commerce-process-title"
      data-step={chapter.active}
    >
      <div className="commerce-section commerce-process-pin">
        <h2 id="commerce-process-title">{t.title}</h2>
        <div className="commerce-process-stage">
          <div className="commerce-process-progress" aria-hidden="true">
            <motion.span style={{ scaleX: chapter.progress }} />
          </div>
          <div className="commerce-process-copy">
            <ol className="commerce-process-steps" aria-label={t.stepsLabel}>
              {t.steps.map((step, index) => (
                <li key={step} aria-current={chapter.active === index ? "step" : undefined}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <figure className="commerce-process-visual">
            <ProductProcessStage progress={chapter.progress} />
            <figcaption>{shots[current]}</figcaption>
          </figure>
          <figure className="commerce-process-source">
            <ProductFrame view="original" />
            <figcaption>{shots.original}</figcaption>
          </figure>
        </div>
        <ol className="commerce-process-list">
          {views.map((view, index) => (
            <li key={view}>
              <h3>{t.steps[index]}</h3>
              <figure>
                <ProductFrame view={view} />
                <figcaption>{shots[view]}</figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
