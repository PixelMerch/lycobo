/** 将滚动映射为背景换场、轨道转动和商品画幅展开；减少动态效果时直接展示静态内容。 */
export function initializeLandingMotion() {
  const hero = document.querySelector<HTMLElement>(".landing-hero-stage");
  const work = document.querySelector<HTMLElement>(".landing-work");
  const close = document.querySelector<HTMLElement>(".landing-close");
  const blue = document.querySelector<HTMLElement>(".landing-backdrop-blue");
  const ink = document.querySelector<HTMLElement>(".landing-backdrop-ink");
  const orbit = document.querySelector<HTMLElement>(".landing-orbit");
  const secondary = document.querySelector<HTMLElement>(".landing-orbit-secondary");
  if (!hero || !work || !close || !blue || !ink || !orbit || !secondary) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reveals = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  let frame = 0;
  let observer: IntersectionObserver | undefined;
  let workTop = 0;
  let closeTop = 0;
  let viewport = window.innerHeight;

  function measure() {
    if (!work || !close) return;
    viewport = window.innerHeight;
    workTop = work.getBoundingClientRect().top + window.scrollY;
    closeTop = close.getBoundingClientRect().top + window.scrollY;
    schedule();
  }

  function draw() {
    frame = 0;
    if (reduced.matches || !hero || !blue || !ink || !orbit || !secondary) return;
    const scroll = window.scrollY;
    const opening = clamp(scroll / (viewport * 0.65));
    // 实色幕布先于下一段文字进入视口，保持首屏洁净和换场中的文字对比度。
    const blueOffset = Math.max(0, workTop - scroll - viewport * 0.25);
    const inkOffset = Math.max(0, closeTop - scroll);
    const blueProgress = clamp(1 - blueOffset / viewport);
    const inkProgress = clamp(1 - inkOffset / viewport);
    blue.style.opacity = "1";
    ink.style.opacity = "1";
    blue.style.transform = `translate3d(0, ${blueOffset}px, 0)`;
    ink.style.transform = `translate3d(0, ${inkOffset}px, 0)`;
    hero.style.transform = `perspective(1600px) rotateX(${5 * (1 - opening)}deg) rotateZ(${-2 * (1 - opening)}deg) scale(${0.94 + opening * 0.06})`;
    const travel = clamp((scroll - workTop + viewport) / Math.max(closeTop - workTop, viewport));
    const orbitPresence = blueProgress * (1 - inkProgress) * opening;
    orbit.style.opacity = String(orbitPresence);
    orbit.style.transform = `translate3d(${45 - travel * 85}vw, ${-20 + travel * 65}vh, 0) rotateX(55deg) rotateZ(${travel * 210 - 30}deg) scale(${0.8 + travel * 0.8})`;
    secondary.style.opacity = String(orbitPresence * 0.7);
    secondary.style.transform = `translate3d(${-35 + travel * 100}vw, ${40 - travel * 60}vh, 0) rotateX(65deg) rotateZ(${-travel * 160}deg)`;
  }

  function schedule() {
    if (!frame && !reduced.matches) frame = requestAnimationFrame(draw);
  }

  function configure() {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    document.body.toggleAttribute("data-motion-ready", !reduced.matches);
    if (reduced.matches) {
      hero?.style.removeProperty("transform");
      for (const element of reveals) element.removeAttribute("data-reveal-pending");
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.removeAttribute("data-reveal-pending");
          observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.08 },
    );
    for (const element of reveals) {
      if (element.getBoundingClientRect().top > viewport) {
        element.setAttribute("data-reveal-pending", "");
        observer.observe(element);
      }
    }
    measure();
  }

  configure();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { once: true });
  reduced.addEventListener("change", configure);
  void document.fonts.ready.then(measure);
  window.addEventListener(
    "pagehide",
    () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", configure);
    },
    { once: true },
  );
}
