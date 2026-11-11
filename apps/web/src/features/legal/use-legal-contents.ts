import { useEffect, useState } from "react";
import { type LegalDocumentId, legalSectionId } from "./legal-document";

/** 跟随实际滚动位置高亮章节，使用动画帧合并事件，不定时轮询。 */
export function useLegalContents(documentId: LegalDocumentId, sectionCount: number) {
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    const headings = Array.from({ length: sectionCount }, (_, index) =>
      document.getElementById(legalSectionId(documentId, index)),
    );
    let frame = 0;
    const update = () => {
      frame = 0;
      const headerBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      let current = -1;
      headings.forEach((heading, index) => {
        if (heading && heading.getBoundingClientRect().top <= headerBottom + 40) current = index;
      });
      setActiveIndex(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [documentId, sectionCount]);
  return activeIndex;
}
