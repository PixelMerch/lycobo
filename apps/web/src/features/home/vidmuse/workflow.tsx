import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { competitors, scoreCards } from "./content";
import { Impact } from "./impact";
import { KitPanel } from "./kit-panel";

type Step = "research" | "summarize" | "create";

const steps: { id: Step; label: string; progress: number }[] = [
  { id: "research", label: "Research", progress: 0.06 },
  { id: "summarize", label: "Summarize", progress: 0.26 },
  { id: "create", label: "Create", progress: 0.46 },
];

const kitKeys = ["videos", "feed", "covers", "copy", "cta"] as const;

function kitKeyForProgress(progress: number) {
  const createProgress = Math.min(1, Math.max(0, (progress - 0.36) / 0.64));
  const index = Math.min(kitKeys.length - 1, Math.floor(createProgress * kitKeys.length));
  return kitKeys[index] ?? "videos";
}

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
        className="vm-researchDemo"
        data-phase={phase}
        data-research-active="true"
        data-research-stage={stage}
        ref={demoRef}
      >
        <div className="vm-competitors">
          {competitors.map((competitor, index) => (
            <ToggleButton
              aria-label={`Compare ${competitor.label}`}
              className="vm-competitor"
              isSelected={selected === index}
              key={competitor.id}
              onChange={() => setSelected(index)}
            >
              <span className="vm-competitorImage">
                <img alt={competitor.label} src={competitor.image} />
              </span>
              {index === 0 && <span className="vm-yourProduct">Your product</span>}
              <span className="vm-signal">
                <b>{competitor.id}</b>
                <span>
                  {competitor.bars.map((width) => (
                    <i key={`${competitor.id}-${width}`} style={{ width: `${width}%` }} />
                  ))}
                </span>
              </span>
              <small>{competitor.note}</small>
              <span className="vm-advantage">{competitor.note}</span>
            </ToggleButton>
          ))}
        </div>
        <div className="vm-analysisLine" />
        <p className="vm-analysisResult" data-stage={stage}>
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
            <span className="vm-analysisDots">
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
      <div className="vm-summary" data-summary-active="true">
        <div className="vm-scoreRing">
          {scoreCards.map((card) => (
            <img alt="" data-dimension={card.dimension} key={card.dimension} src={card.icon} />
          ))}
        </div>

        <div className="vm-summaryVideo">
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
            src="/vidmuse/summarize.mp4"
          />
          <Button
            isIconOnly
            aria-label={playing ? "Pause campaign video" : "Play campaign video"}
            className="vm-videoToggle"
            onPress={toggle}
          >
            <span>{playing ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}</span>
          </Button>
        </div>

        <div className="vm-scoreCards">
          {scoreCards.map((card) => (
            <div className="vm-scoreCard" data-score={card.dimension} key={card.dimension}>
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
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("research");
  const [kitKey, setKitKey] = useState<string>("videos");
  const [desktop, setDesktop] = useState(true);
  const lockRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setDesktop(media.matches && !reduced.matches);
    sync();
    media.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const onScroll = () => {
      if (Date.now() < lockRef.current) return;
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const start = top - 96;
      const travel = Math.max(1, rect.height - 792);
      const progress = (window.scrollY - start) / travel;
      if (progress < 0.2) setStep("research");
      else if (progress < 0.36) setStep("summarize");
      else {
        setStep("create");
        setKitKey(kitKeyForProgress(progress));
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [desktop]);

  const selectStep = (next: Step) => {
    setStep(next);
    const rail = railRef.current;
    if (!desktop || !rail) return;
    const rect = rail.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const travel = Math.max(1, rect.height - 792);
    const target = steps.find((item) => item.id === next)?.progress ?? 0;
    lockRef.current = Date.now() + 900;
    window.scrollTo({ top: top - 96 + travel * target, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="campaign-research-title" className="vm-research" id="research">
      <div aria-hidden="true" className="vm-researchBackground">
        <img alt="" src="/vidmuse/research-bg.webp" />
      </div>

      <div className="vm-researchHeading">
        <span className="cn-badge vm-researchEyebrow">From research to ready-to-run</span>
        <h2 id="campaign-research-title">Research the Winners, Ship the Whole Campaign</h2>
        <p>
          VidMuse analyzes competitor ads, rebuilds the patterns behind their performance, and
          generates ready-to-test videos, images, hooks, copy, covers and CTAs for every platform in
          one click.
        </p>
      </div>

      <div className="vm-workflowRail" data-scroll-enabled={desktop} ref={railRef}>
        <div className="vm-workflowPin">
          <div className="vm-workflow" id="campaign-workflow" data-step={step}>
            <div className="vm-workflowBody">
              <ToggleButtonGroup
                aria-label="Campaign workflow"
                className="vm-workflowTabs"
                data-step={step}
                disallowEmptySelection
                isDetached
                selectedKeys={[step]}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const [next] = [...keys];
                  const found = steps.find((item) => item.id === next);
                  if (found) selectStep(found.id);
                }}
              >
                <span aria-hidden="true" className="vm-workflowIndicator" />
                {steps.map((item) => (
                  <ToggleButton id={item.id} key={item.id}>
                    {item.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <AnimatePresence mode="wait">
                <motion.div {...PANEL_MOTION} className="vm-workflowPanel" key={step}>
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
