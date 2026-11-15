import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";
import { useMessages } from "../../i18n/messages";
import { workspaceToolMessages } from "./workspace-tool-messages";

/** 在素材栏旁显示并拖动页面的滚动位置。 */
export function WorkspaceScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef(0);
  const t = useMessages(workspaceToolMessages);

  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const scroller = document.scrollingElement;
    if (!track || !thumb || !scroller) return;

    const update = () => {
      const viewportHeight = scroller.clientHeight;
      const scrollRange = scroller.scrollHeight - viewportHeight;
      track.toggleAttribute("inert", scrollRange <= 0);
      if (scrollRange <= 0) return;

      const trackHeight = track.clientHeight;
      const thumbHeight = Math.min(
        trackHeight,
        Math.max(32, (viewportHeight / scroller.scrollHeight) * trackHeight),
      );
      const progress = Math.min(1, Math.max(0, scroller.scrollTop / scrollRange));
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${progress * (trackHeight - thumbHeight)}px)`;
      thumb.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    };

    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    observer.observe(track);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragOffset.current = event.clientY - event.currentTarget.getBoundingClientRect().top;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    const scroller = document.scrollingElement;
    if (!track || !scroller || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const travel = track.clientHeight - event.currentTarget.offsetHeight;
    if (travel <= 0) return;
    const offset = event.clientY - track.getBoundingClientRect().top - dragOffset.current;
    scroller.scrollTop = (offset / travel) * (scroller.scrollHeight - scroller.clientHeight);
  }

  function scrollWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const scroller = document.scrollingElement;
    if (!scroller) return;
    const positions = {
      ArrowUp: scroller.scrollTop - 40,
      ArrowDown: scroller.scrollTop + 40,
      PageUp: scroller.scrollTop - scroller.clientHeight,
      PageDown: scroller.scrollTop + scroller.clientHeight,
      Home: 0,
      End: scroller.scrollHeight,
    };
    const target = Object.entries(positions).find(([key]) => key === event.key);
    if (!target) return;
    event.preventDefault();
    scroller.scrollTop = target[1];
  }

  return (
    <div className="workspace-scrollbar" ref={trackRef} inert>
      <div
        ref={thumbRef}
        className="workspace-scrollbar-thumb"
        role="scrollbar"
        tabIndex={0}
        aria-label={t.pageScroll}
        aria-controls="commerce-workspace"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-orientation="vertical"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onKeyDown={scrollWithKeyboard}
      />
    </div>
  );
}
