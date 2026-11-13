import { useEffect, useRef, useState } from "react";

type Step = "research" | "summarize" | "create";

/** 工作流页签及对应的滚动进度。 */
export const workflowSteps: { id: Step; label: string; progress: number }[] = [
  { id: "research", label: "Research", progress: 0.06 },
  { id: "summarize", label: "Summarize", progress: 0.26 },
  { id: "create", label: "Create", progress: 0.46 },
];

const kitKeys = ["videos", "feed", "covers", "copy", "cta"] as const;
const workflowBaseHeight = 832;
const workflowTop = 96;

function sizeWorkflow(rail: HTMLDivElement) {
  const viewport = window.innerHeight;
  const height = Math.min(workflowBaseHeight, Math.max(1, viewport - workflowTop - 12));
  const scale = height / workflowBaseHeight;
  const top = Math.max(workflowTop, (viewport - workflowBaseHeight) / 2 + 42);
  const travel = Math.min(3640, Math.max(2240, viewport * 3.15));
  rail.style.setProperty("--workflow-height", `${height}px`);
  rail.style.setProperty("--workflow-scale", String(scale));
  rail.style.setProperty("--workflow-width", `calc(100% / ${scale})`);
  rail.style.setProperty("--workflow-top", `${top}px`);
  rail.style.setProperty("--workflow-travel", `${travel}px`);
}

function workflowScroll(rail: HTMLDivElement) {
  const pin = rail.firstElementChild;
  if (!pin) return null;
  const top = Number.parseFloat(getComputedStyle(pin).top);
  if (!Number.isFinite(top)) return null;
  return {
    start: rail.getBoundingClientRect().top + window.scrollY - top,
    travel: Math.max(1, rail.clientHeight - pin.clientHeight),
  };
}

function kitKeyForProgress(progress: number) {
  const createProgress = Math.min(1, Math.max(0, (progress - 0.36) / 0.64));
  const index = Math.min(kitKeys.length - 1, Math.floor(createProgress * kitKeys.length));
  return kitKeys[index] ?? "videos";
}

function stepForProgress(progress: number): Step {
  if (progress < 0.2) return "research";
  return progress < 0.36 ? "summarize" : "create";
}

/** 将滚动位置与工作流阶段同步，并支持通过页签定位。 */
export function useWorkflowScroll() {
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("research");
  const [kitKey, setKitKey] = useState<string>("videos");
  const [desktop, setDesktop] = useState(true);
  const lockRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(width > 900px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const enabled = media.matches && !reduced.matches;
      setDesktop(enabled);
      if (enabled && railRef.current) sizeWorkflow(railRef.current);
    };
    sync();
    media.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const onScroll = () => {
      if (Date.now() < lockRef.current) return;
      const rail = railRef.current;
      if (!rail) return;
      const geometry = workflowScroll(rail);
      if (!geometry) return;
      const progress = (window.scrollY - geometry.start) / geometry.travel;
      const next = stepForProgress(progress);
      setStep(next);
      if (next === "create") setKitKey(kitKeyForProgress(progress));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [desktop]);

  const selectStep = (next: Step) => {
    setStep(next);
    const rail = railRef.current;
    if (!desktop || !rail) return;
    const geometry = workflowScroll(rail);
    if (!geometry) return;
    const target = workflowSteps.find((item) => item.id === next)?.progress ?? 0;
    lockRef.current = Date.now() + 900;
    window.scrollTo({ top: geometry.start + geometry.travel * target, behavior: "smooth" });
  };

  return { railRef, step, kitKey, setKitKey, desktop, selectStep };
}
