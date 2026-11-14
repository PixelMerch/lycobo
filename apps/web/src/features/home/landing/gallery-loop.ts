/** 把位置映射到中间副本，前后两侧保留同样的图片用于无缝接续。 */
export function wrapGalleryPosition(position: number, period: number) {
  if (period <= 0) return position;
  return period + ((((position - period) % period) + period) % period);
}

/** 驱动原生横向滚动；宽度只在布局变化时测量，交互期间由浏览器接管位置。 */
export function createGalleryLoop(
  element: HTMLElement,
  reduced: boolean,
  visible: boolean,
  engaged: () => boolean,
) {
  let period = 0;
  let step = 0;
  let position = element.scrollLeft;
  let resumeAt = 0;
  let frame = 0;
  let lastTime = 0;
  const measure = () => {
    const group = element.querySelector<HTMLElement>(".commerce-gallery-group");
    if (!group) return;
    const nextPeriod = group.getBoundingClientRect().width;
    const previousPeriod = period || nextPeriod;
    const fraction =
      previousPeriod > 0
        ? (((position % previousPeriod) + previousPeriod) % previousPeriod) / previousPeriod
        : 0;
    period = nextPeriod;
    step = period / group.children.length;
    position = reduced ? fraction * period : (1 + fraction) * period;
    element.scrollLeft = position;
  };
  const tick = (time: number) => {
    if (document.hidden) return;
    const elapsed = lastTime ? Math.min(time - lastTime, 48) : 0;
    lastTime = time;
    if (engaged() || time < resumeAt) {
      position = element.scrollLeft;
    } else {
      position = wrapGalleryPosition(position + elapsed * 0.032, period);
      element.scrollLeft = position;
    }
    frame = requestAnimationFrame(tick);
  };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    lastTime = 0;
    if (!document.hidden && visible && !reduced) frame = requestAnimationFrame(tick);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  measure();
  onVisibility();
  document.addEventListener("visibilitychange", onVisibility);
  return {
    hold: () => {
      resumeAt = performance.now() + 1600;
    },
    move: (direction: number) => {
      resumeAt = performance.now() + 800;
      // 快速连按先归入相同画面的中间副本，给下一次平滑移动留足空间。
      if (!reduced) element.scrollLeft = wrapGalleryPosition(element.scrollLeft, period);
      element.scrollBy({ left: direction * step, behavior: reduced ? "instant" : "smooth" });
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
