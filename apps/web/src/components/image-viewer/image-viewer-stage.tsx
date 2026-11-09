import { Spinner } from "@heroui/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useErrorToast } from "../../lib/error-toast";
import { imageWheelFactor } from "./image-zoom-motion";
import { useImageViewerZoom } from "./use-image-viewer-zoom";
export type ViewerImage = { src: string; thumbnailSrc?: string; alt: string };
type Point = { x: number; y: number };
const origin = { x: 0, y: 0 };

export function useImageViewerStage(active: ViewerImage | undefined) {
  const [angle, setAngle] = useState(0);
  const [pan, setPan] = useState<Point>(origin);
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [failed, setFailed] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const drag = useRef<{ pointer: Point; pan: Point } | null>(null);
  const wheelZoom = useRef<(delta: number, ctrlKey?: boolean) => void>(() => undefined);
  const ready = loadedSrc === active?.src && viewport.width > 1 && viewport.height > 1;
  const { zoom, zoomBy, zoomStep, reset: resetZoom } = useImageViewerZoom(() => setPan(origin));
  const turned = Math.abs(angle % 180) === 90;
  const visualWidth = turned ? natural.height : natural.width;
  const visualHeight = turned ? natural.width : natural.height;
  const fit = Math.min(viewport.width / visualWidth, viewport.height / visualHeight, 1);
  const width = visualWidth * fit;
  const height = visualHeight * fit;
  const limit = {
    x: Math.max(0, ((width * zoom) / 100 - viewport.width) / 2),
    y: Math.max(0, ((height * zoom) / 100 - viewport.height) / 2),
  };
  const clamp = (point: Point) => ({
    x: Math.max(-limit.x, Math.min(limit.x, point.x)),
    y: Math.max(-limit.y, Math.min(limit.y, point.y)),
  });
  const visiblePan = clamp(pan);
  wheelZoom.current = ready
    ? (delta, ctrlKey) => zoomBy(imageWheelFactor(delta, ctrlKey))
    : () => undefined;
  /* The first fitted frame must paint without transitions: `fit` starts at 1
   * before the natural size is known, so an animated change would show the
   * picture oversized for a moment when the viewer opens or switches images. */
  useEffect(() => {
    if (!ready) {
      setAnimated(false);
      return;
    }
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);
  useEffect(() => {
    const element = area;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resize.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelZoom.current(event.deltaY, event.ctrlKey);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      element.removeEventListener("wheel", wheel);
    };
  }, [area]);
  useErrorToast(failed ? "图片加载失败，请关闭后重新打开。" : null);
  function reset() {
    resetZoom();
    setLoadedSrc(null);
    setAngle(0);
    setPan(origin);
    setFailed(false);
    setDragging(false);
    drag.current = null;
  }
  const endPan = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  function rotate(degrees: number) {
    setAngle((value) => value + degrees);
    setPan(origin);
  }
  return {
    ready,
    failed,
    zoom,
    rotate,
    zoomStep,
    reset,
    setArea,
    dragging,
    drag,
    visiblePan,
    setDragging,
    setPan,
    clamp,
    endPan,
    animated,
    natural,
    angle,
    fit,
    setNatural,
    setLoadedSrc,
    setFailed,
  };
}

export function ImageViewerStage({
  active,
  stage,
}: {
  active: ViewerImage;
  stage: ReturnType<typeof useImageViewerStage>;
}) {
  const {
    ready,
    failed,
    zoom,
    setArea,
    dragging,
    drag,
    visiblePan,
    setDragging,
    setPan,
    clamp,
    endPan,
    animated,
    natural,
    angle,
    fit,
    setNatural,
    setLoadedSrc,
    setFailed,
  } = stage;
  return (
    <section
      ref={setArea}
      className="browse-image-area"
      aria-busy={!ready && !failed}
      aria-label="浏览图片区域"
      data-zoomed={zoom > 100}
      data-dragging={dragging}
      onPointerDown={(event) => {
        if (
          zoom <= 100 ||
          event.button !== 0 ||
          !(event.target instanceof Element && event.target.closest(".browse-image-picture"))
        )
          return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointer: { x: event.clientX, y: event.clientY },
          pan: visiblePan,
        };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start)
          setPan(
            clamp({
              x: start.pan.x + event.clientX - start.pointer.x,
              y: start.pan.y + event.clientY - start.pointer.y,
            }),
          );
      }}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onLostPointerCapture={endPan}
    >
      {!ready && !failed && <Spinner className="browse-image-loading" aria-label="图片加载中" />}
      <div className="browse-image-frame">
        <div
          className="browse-image-transform"
          style={{
            transform: `translate(${visiblePan.x}px, ${visiblePan.y}px) scale(${zoom / 100})`,
          }}
        >
          <img
            key={active.src}
            src={active.src}
            crossOrigin="anonymous"
            referrerPolicy="strict-origin-when-cross-origin"
            alt={active.alt}
            draggable={false}
            className="browse-image-picture"
            data-animated={animated}
            style={{
              width: natural.width,
              height: natural.height,
              rotate: `${angle}deg`,
              scale: String(fit),
            }}
            onLoad={(event) => {
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
              setLoadedSrc(active.src);
            }}
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    </section>
  );
}
