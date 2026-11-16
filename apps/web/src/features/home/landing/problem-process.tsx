import { useEffect, useRef } from "react";
import { useMessages } from "../../../i18n/messages";
import { processMessages } from "./process-messages";
import "./commerce-process.css";

const secondaryViews = ["scene", "detail"] as const;

/** 用灰阶图解展示同款商品从原图到主图、场景和细节的关系。 */
export function ProblemProcess() {
  const t = useMessages(processMessages);
  const board = useProcessReveal();

  return (
    <section
      id="problem-and-workflow"
      className="commerce-process"
      aria-labelledby="commerce-process-title"
    >
      <div className="commerce-section">
        <h2 id="commerce-process-title" className="commerce-process-title">
          <span>{t.title.lead}</span> <span>{t.title.continuation}</span>
        </h2>
        <div ref={board} className="commerce-process-board">
          <ProcessFrame kind="original" label={t.frames.original} />
          <span aria-hidden="true" className="commerce-process-connector" />
          <div className="commerce-process-results">
            <ProcessFrame kind="main" label={t.frames.main} />
            <div className="commerce-process-variants">
              {secondaryViews.map((view) => (
                <ProcessFrame key={view} kind={view} label={t.frames[view]} />
              ))}
            </div>
          </div>
        </div>
        <ol aria-label={t.stepsLabel} className="commerce-process-steps">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProcessFrame({
  kind,
  label,
}: {
  kind: "original" | "main" | (typeof secondaryViews)[number];
  label: string;
}) {
  return (
    <figure className={`commerce-process-figure commerce-process-${kind}`}>
      <div className="commerce-process-plane" aria-hidden="true">
        <span />
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function useProcessReveal() {
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = board.current;
    if (
      !element ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      element.getBoundingClientRect().bottom <= 0
    )
      return;

    element.dataset.reveal = "pending";

    const cleanUp = () => {
      observer.disconnect();
      window.removeEventListener("scroll", finishIfPassed);
    };

    const finishIfPassed = () => {
      // 快速跨过图组时直接显示终态，回看无需补播。
      if (element.getBoundingClientRect().bottom > 0) return;
      delete element.dataset.reveal;
      cleanUp();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || entry.intersectionRatio < 0.2) return;
        element.dataset.reveal = "playing";
        cleanUp();
      },
      { threshold: 0.2 },
    );

    window.addEventListener("scroll", finishIfPassed, { passive: true });
    observer.observe(element);
    return () => {
      cleanUp();
      delete element.dataset.reveal;
    };
  }, []);

  return board;
}
