import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const localSceneModule = "/__vidmuse-scene/mount.mjs";

type MountedScene = { resize: () => void; destroy: () => void };
type SceneModule = {
  mountScene: (element: HTMLDivElement, options: { signal: AbortSignal }) => Promise<MountedScene>;
};

function isSceneModule(value: unknown): value is SceneModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "mountScene" in value &&
    typeof value.mountScene === "function"
  );
}

/** 开发预览中挂载本地采集的背景场景，失败或减少动效时显示 CSS 后备背景。 */
export function HeroScene() {
  const reducedMotion = useReducedMotion();
  return reducedMotion ? null : <MountedHeroScene />;
}

function MountedHeroScene() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const controller = new AbortController();
    let mounted: MountedScene | undefined;
    const observer = new ResizeObserver(() => mounted?.resize());

    async function load(target: HTMLDivElement) {
      const sceneModule: unknown = await import(localSceneModule);
      if (!isSceneModule(sceneModule)) return;
      const scene = await sceneModule.mountScene(target, { signal: controller.signal });
      if (controller.signal.aborted) {
        scene.destroy();
        return;
      }
      mounted = scene;
      observer.observe(target);
      setReady(true);
    }

    void load(element).catch(() => {
      if (!controller.signal.aborted) setReady(false);
    });

    return () => {
      controller.abort();
      observer.disconnect();
      mounted?.destroy();
    };
  }, []);

  return <div className="vm-heroScene" data-ready={ready} ref={host} />;
}
