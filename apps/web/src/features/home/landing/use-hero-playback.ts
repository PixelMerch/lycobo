import { useEffect, useRef, useState } from "react";

/** 轮播离开视口或标签页进入后台时暂停。 */
export function useHeroPlayback() {
  const stageRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let intersecting = false;
    function update() {
      setInView(intersecting && !document.hidden);
    }
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false;
      update();
    });
    observer.observe(stage);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { stageRef, inView };
}
