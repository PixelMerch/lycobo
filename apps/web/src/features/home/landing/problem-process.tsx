import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { motion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { processMessages } from "./process-messages";
import { ProductFrame } from "./product-frame";
import { ProductProcessStage } from "./product-process-stage";
import { useShowcaseScroll } from "./use-showcase-scroll";
import "./commerce-process.css";

const scrollMedia =
  "(min-width: 901px) and (min-height: 660px) and (prefers-reduced-motion: no-preference)";
const views = ["original", "studio", "scene", "detail"] as const;

/** 桌面跟随滚动，窄屏可点选步骤，减少动态效果时按顺序展示静态图。 */
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
            <ToggleButtonGroup
              className="commerce-process-steps"
              aria-label={t.stepsLabel}
              orientation="vertical"
              isDetached
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[String(chapter.active)]}
              onSelectionChange={(keys) => {
                const [key] = keys;
                const index = Number(key);
                if (views[index]) chapter.select(index);
              }}
            >
              {t.steps.map((step, index) => (
                <ToggleButton id={String(index)} key={step.title}>
                  {step.title}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <p>{t.steps[chapter.active]?.description}</p>
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
              <h3>{t.steps[index]?.title}</h3>
              <p>{t.steps[index]?.description}</p>
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
