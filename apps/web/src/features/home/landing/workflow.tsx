import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { competitors, scoreCards } from "./content";
import { Impact } from "./impact";
import { KitPanel } from "./kit-panel";

import { useWorkflowScroll, workflowSteps } from "./use-workflow-scroll";

const PANEL_MOTION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

type ResearchPhase = "idle" | "bars" | "line" | "done";

function ResearchPanel() {
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState<ResearchPhase>("idle");
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = demoRef.current;
    if (!node) return;
    let lineTimer: number | undefined;
    let doneTimer: number | undefined;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || started) return;
        started = true;
        setPhase("bars");
        lineTimer = window.setTimeout(() => setPhase("line"), 780);
        doneTimer = window.setTimeout(() => setPhase("done"), 1300);
      },
      { threshold: 0.45 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (lineTimer) window.clearTimeout(lineTimer);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, []);

  const stage = phase === "done" ? "done" : "analyzing";

  return (
    <>
      <h3>Competitor analysis</h3>
      <div
        className="lp-researchDemo"
        data-phase={phase}
        data-research-active="true"
        data-research-stage={stage}
        ref={demoRef}
      >
        <div className="lp-competitors">
          {competitors.map((competitor, index) => (
            <ToggleButton
              aria-label={`Compare ${competitor.label}`}
              className="lp-competitor"
              isSelected={selected === index}
              key={competitor.id}
              onChange={() => setSelected(index)}
            >
              <span className="lp-competitorImage">
                <img alt={competitor.label} src={competitor.image} />
              </span>
              {index === 0 && <span className="lp-yourProduct">Your product</span>}
              <span className="lp-signal">
                <b>{competitor.id}</b>
                <span>
                  {competitor.bars.map((width) => (
                    <i key={`${competitor.id}-${width}`} style={{ width: `${width}%` }} />
                  ))}
                </span>
              </span>
              <small>{competitor.note}</small>
              <span className="lp-advantage">{competitor.note}</span>
            </ToggleButton>
          ))}
        </div>
        <div className="lp-analysisLine" />
        <p className="lp-analysisResult" data-stage={stage}>
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              key={stage}
              transition={{ duration: 0.25 }}
            >
              {stage === "analyzing"
                ? "Analyzing 4 competitors"
                : "Your product wins on Hook & Proof"}
            </motion.span>
          </AnimatePresence>
          {stage === "analyzing" && (
            <span className="lp-analysisDots">
              <i />
              <i />
              <i />
            </span>
          )}
        </p>
      </div>
    </>
  );
}

function SummarizePanel() {
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <h3>See what makes ads win</h3>
      <div className="lp-summary" data-summary-active="true">
        <div className="lp-scoreRing">
          {scoreCards.map((card) => (
            <img alt="" data-dimension={card.dimension} key={card.dimension} src={card.icon} />
          ))}
        </div>

        <div className="lp-summaryVideo">
          <i />
          <i />
          <video
            aria-label="Campaign creative example"
            autoPlay
            loop
            muted
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            playsInline
            ref={videoRef}
            src="/landing/summarize.mp4"
          />
          <Button
            isIconOnly
            aria-label={playing ? "Pause campaign video" : "Play campaign video"}
            className="lp-videoToggle"
            onPress={toggle}
          >
            <span>{playing ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}</span>
          </Button>
        </div>

        <div className="lp-scoreCards">
          {scoreCards.map((card) => (
            <div className="lp-scoreCard" data-score={card.dimension} key={card.dimension}>
              <strong>
                {card.score}
                <small>score</small>
              </strong>
              <div>
                <b>{card.dimension}</b>
                <span>{card.caption}</span>
              </div>
              {card.weakest && <em>Weakest · rebuild first</em>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** 复刻页 Research / Summarize / Create 滚动工作流。 */
export function Workflow() {
  const { railRef, step, kitKey, setKitKey, desktop, selectStep } = useWorkflowScroll();

  return (
    <section aria-labelledby="campaign-research-title" className="lp-research" id="research">
      <div aria-hidden="true" className="lp-researchBackground">
        <img alt="" src="/landing/research-bg.webp" />
      </div>

      <div className="lp-researchHeading">
        <span className="cn-badge lp-researchEyebrow">From research to ready-to-run</span>
        <h2 id="campaign-research-title">Research the Winners, Ship the Whole Campaign</h2>
        <p>
          Analyze competitor ads, rebuild the patterns behind their performance, and generate
          ready-to-test videos, images, hooks, copy, covers and CTAs for every platform in one
          click.
        </p>
      </div>

      <div className="lp-workflowRail" data-scroll-enabled={desktop} ref={railRef}>
        <div className="lp-workflowPin">
          <div className="lp-workflow" id="campaign-workflow" data-step={step}>
            <div className="lp-workflowBody">
              <ToggleButtonGroup
                aria-label="Campaign workflow"
                className="lp-workflowTabs"
                data-step={step}
                disallowEmptySelection
                isDetached
                selectedKeys={[step]}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const [next] = keys;
                  const found = workflowSteps.find((item) => item.id === next);
                  if (found) selectStep(found.id);
                }}
              >
                <span aria-hidden="true" className="lp-workflowIndicator" />
                {workflowSteps.map((item) => (
                  <ToggleButton id={item.id} key={item.id}>
                    {item.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <AnimatePresence mode="wait">
                <motion.div {...PANEL_MOTION} className="lp-workflowPanel" key={step}>
                  {step === "research" && <ResearchPanel />}
                  {step === "summarize" && <SummarizePanel />}
                  {step === "create" && (
                    <>
                      <h3>Your complete campaign kit</h3>
                      <KitPanel expandedKey={kitKey} onExpandedChange={setKitKey} />
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <Impact />
    </section>
  );
}
