import { afterEach, describe, expect, it, vi } from "vitest";
import { createLandingDemoMotion } from "../apps/web/src/features/home/landing/landing-demo-motion.ts";
import { createLandingFeatureMotion } from "../apps/web/src/features/home/landing/landing-feature-motion.ts";
import { createLandingMotionTimeline } from "../apps/web/src/features/home/landing/landing-motion-timeline.ts";
import { initializeLandingMotion } from "../apps/web/src/features/home/landing/landing-showcase.ts";

const createTimeline = () =>
  createLandingMotionTimeline(createLandingFeatureMotion, createLandingDemoMotion);

function motionEnvironment(reduce = false) {
  const frames = new Map();
  let nextFrame = 0;
  let time = 0;
  const node = (height = 0, top = 0) => ({
    offsetHeight: height,
    attributes: new Set(),
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      },
    },
    contains(target) {
      return target === this;
    },
    getBoundingClientRect: () => ({ top }),
    setAttribute(name) {
      this.attributes.add(name);
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
    toggleAttribute(name, value) {
      if (value) this.attributes.add(name);
      else this.attributes.delete(name);
    },
  });
  const hero = node(1160);
  const stage = node(800);
  const heading = node();
  const art = node();
  const source = node();
  const reveal = node(0, 1600);
  const elements = new Map([
    [".lycobo-hero", hero],
    [".landing-hero-stage", stage],
    [".landing-hero-art", art],
    [".landing-heading-row", heading],
    [".landing-source-proof", source],
  ]);
  const media = Object.assign(new EventTarget(), { matches: reduce });
  const window = Object.assign(new EventTarget(), {
    innerHeight: 800,
    innerWidth: 1440,
    scrollY: 0,
    matchMedia: () => media,
  });
  const document = Object.assign(new EventTarget(), {
    body: node(),
    activeElement: null,
    fonts: { ready: Promise.resolve() },
    querySelector: (selector) => elements.get(selector),
    querySelectorAll: (selector) => (selector === "[data-reveal]" ? [reveal] : []),
  });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));
  return {
    hero,
    stage,
    heading,
    art,
    source,
    reveal,
    media,
    window,
    document,
    frames,
    settle() {
      for (let count = 0; frames.size && count < 150; count++) {
        const callbacks = [...frames.values()];
        frames.clear();
        time += 16;
        for (const callback of callbacks) callback(time);
      }
      expect(frames.size).toBe(0);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("landing motion accessibility and lifecycle", () => {
  it("keeps the user's comparison position during scrolling and motion changes", () => {
    const env = motionEnvironment();
    const control = Object.assign(new EventTarget(), { hidden: true, valueAsNumber: 57 });
    const art = {
      getBoundingClientRect: () => ({ top: 1000 }),
      offsetHeight: 500,
      querySelector: () => control,
      style: { setProperty: vi.fn() },
    };
    const query = env.document.querySelector;
    env.document.querySelector = (selector) =>
      selector === ".landing-comparison-art" ? art : query(selector);
    const demo = createLandingDemoMotion();
    demo.measure(0, 800);
    demo.draw(850);
    expect(control.hidden).toBe(false);
    expect(control.valueAsNumber).toBe(52);
    control.valueAsNumber = 42;
    control.dispatchEvent(new Event("input"));
    demo.draw(0);
    demo.reset();
    expect(art.style.setProperty).toHaveBeenLastCalledWith("--landing-comparison-cut", "42%");
    expect(control.valueAsNumber).toBe(42);
  });

  it("keeps focused hero actions visible after the scroll transition", async () => {
    const env = motionEnvironment();
    initializeLandingMotion(createTimeline);
    await Promise.resolve();
    env.settle();
    expect(env.stage.style["--landing-hero-blend"]).toBe("0");
    env.window.scrollY = 600;
    env.window.dispatchEvent(new Event("scroll"));
    env.settle();
    expect(env.heading.style.opacity).toBe("0");
    expect(env.stage.style["--landing-hero-blend"]).toBe("1");
    env.document.activeElement = env.hero;
    env.document.dispatchEvent(new Event("focusin"));
    env.settle();
    expect(env.heading.style.opacity).toBe("1");
    expect(env.heading.style.pointerEvents).toBe("");
  });

  it("removes transforms, hidden content and extra scroll space when motion is reduced", async () => {
    const env = motionEnvironment();
    initializeLandingMotion(createTimeline);
    await Promise.resolve();
    env.settle();
    expect(env.document.body.attributes.has("data-motion-ready")).toBe(true);
    expect(env.art.style.transform).toBeTruthy();
    env.media.matches = true;
    env.media.dispatchEvent(new Event("change"));
    expect(env.document.body.attributes.has("data-motion-ready")).toBe(false);
    expect(env.art.style.transform).toBeUndefined();
    expect(env.stage.style["--landing-hero-blend"]).toBeUndefined();
    expect(env.reveal.attributes.has("data-reveal-pending")).toBe(false);
    expect(env.frames.size).toBe(0);
  });

  it("does not restart rendering after pagehide, including a pending font callback", async () => {
    const env = motionEnvironment();
    initializeLandingMotion(createTimeline);
    env.window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();
    env.window.dispatchEvent(new Event("resize"));
    env.window.dispatchEvent(new Event("scroll"));
    env.document.dispatchEvent(new Event("focusin"));
    expect(env.frames.size).toBe(0);
  });
});
