import { useEffect, useRef } from "react";

const scenes = ["p02-blender-hero", "p02-motion-sage", "p02-motion-rose"];

/** 固定商品构图揭示场景变化，素材就绪且可见时才播放一次。 */
export function SceneDemo({ alt }: { alt: string }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let visible = false;
    let ready = false;
    let disposed = false;
    const update = () => {
      element.dataset.playing = String(visible && ready && !document.hidden);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry && entry.intersectionRatio >= 0.5);
        update();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    // 等图片解码后再揭示，避免慢网速下先出现空白场景。
    void Promise.allSettled(
      [...element.querySelectorAll("img")].map((image) => image.decode()),
    ).then((results) => {
      if (disposed) return;
      ready = results.every((result) => result.status === "fulfilled");
      update();
    });
    document.addEventListener("visibilitychange", update);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={stage} className="commerce-scene-demo" role="img" aria-label={alt}>
      {scenes.map((scene) => (
        <img key={scene} src={`/landing/commerce/${scene}.webp`} alt="" decoding="async" />
      ))}
    </div>
  );
}
