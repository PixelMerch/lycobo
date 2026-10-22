import { Button, Modal, Spinner, Toolbar, Tooltip } from "@heroui/react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconRotate,
  IconRotateClockwise,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useErrorToast } from "../lib/error-toast";
import { DialogClose } from "./dialog-close";
import { UiIcon } from "./ui-icon";
import { useCenteredDialogMotion } from "./use-centered-dialog-motion";
import "./image-viewer.css";

export type ViewerImage = { src: string; alt: string };
type Point = { x: number; y: number };
const origin = { x: 0, y: 0 };

/** Reusable, read-only image viewer. Callers supply URLs and keep the opener mounted. */
export function ImageViewer({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: ViewerImage[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const active = images[index];
  const [zoom, setZoom] = useState(100);
  const zoomValue = useRef(100);
  const zoomGoal = useRef(100);
  const zoomFrame = useRef<number | null>(null);
  const [angle, setAngle] = useState(0);
  const [pan, setPan] = useState<Point>(origin);
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [failed, setFailed] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const dismissStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const drag = useRef<{ pointer: Point; pan: Point } | null>(null);
  const wheelZoom = useRef<(delta: number) => void>(() => {});
  const ready = loadedSrc === active?.src && viewport.width > 1 && viewport.height > 1;
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
  /* Zoom is eased toward its goal so wheel input and button steps stay smooth
   * instead of jumping a fixed step per event. */
  const animateZoom = () => {
    if (zoomFrame.current !== null) return;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(64, now - last);
      last = now;
      const goal = zoomGoal.current;
      const current = zoomValue.current;
      const next =
        Math.abs(goal - current) < 0.3
          ? goal
          : current + (goal - current) * (1 - Math.exp(-elapsed / 70));
      zoomValue.current = next;
      setZoom(next);
      zoomFrame.current = next === goal ? null : requestAnimationFrame(step);
    };
    zoomFrame.current = requestAnimationFrame(step);
  };
  const zoomTo = (value: number) => {
    zoomGoal.current = Math.min(500, Math.max(25, value));
    setPan(origin);
    if (reducedMotion) {
      zoomValue.current = zoomGoal.current;
      setZoom(zoomGoal.current);
      return;
    }
    animateZoom();
  };
  const zoomBy = (factor: number) => zoomTo(zoomGoal.current * factor);
  wheelZoom.current = ready
    ? (delta) => zoomBy(Math.exp(-delta * (Math.log(1.1) / 100)))
    : () => {};
  useEffect(
    () => () => {
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    },
    [],
  );
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
      const delta = Math.max(-150, Math.min(150, event.deltaY)) * (event.ctrlKey ? 4 : 1);
      wheelZoom.current(delta);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      element.removeEventListener("wheel", wheel);
    };
  }, [area]);
  useErrorToast(failed ? "图片加载失败，请关闭后重新打开。" : null);
  const select = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= images.length) return;
    if (zoomFrame.current !== null) {
      cancelAnimationFrame(zoomFrame.current);
      zoomFrame.current = null;
    }
    zoomValue.current = 100;
    zoomGoal.current = 100;
    setLoadedSrc(null);
    setIndex(next);
    setZoom(100);
    setAngle(0);
    setPan(origin);
    setFailed(false);
    setDragging(false);
    drag.current = null;
  };
  const endPan = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!active) return null;
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className="browse-image-backdrop" data-dialog-phase={phase}>
        <Modal.Container size="full" className="browse-image-container">
          <Modal.Dialog aria-label="图片浏览" className="browse-image-dialog">
            <motion.div
              className="browse-image-surface"
              data-ready={ready}
              {...surfaceMotion}
              onPointerDown={(event) => {
                dismissStart.current =
                  event.button === 0 &&
                  event.target instanceof Element &&
                  !event.target.closest("button, .browse-image-picture")
                    ? { id: event.pointerId, x: event.clientX, y: event.clientY }
                    : null;
              }}
              onPointerUp={(event) => {
                const start = dismissStart.current;
                dismissStart.current = null;
                if (
                  start &&
                  start.id === event.pointerId &&
                  Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4 &&
                  event.target instanceof Element &&
                  !event.target.closest("button, .browse-image-picture")
                )
                  requestClose();
              }}
              onPointerCancel={() => {
                dismissStart.current = null;
              }}
              onKeyDownCapture={(event) => {
                /* Arrow keys always flip between images, including when the
                 * toolbar owns focus; the toolbar must not move its own focus
                 * ring instead. */
                if (
                  images.length < 2 ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey
                )
                  return;
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                event.stopPropagation();
                select(event.key === "ArrowLeft" ? -1 : 1);
              }}
            >
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
                    !(
                      event.target instanceof Element &&
                      event.target.closest(".browse-image-picture")
                    )
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
                {!ready && !failed && (
                  <Spinner className="browse-image-loading" aria-label="图片加载中" />
                )}
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
                  {ready && images.length > 1 && (
                    <>
                      {index > 0 && (
                        <Button
                          isIconOnly
                          size="lg"
                          variant="ghost"
                          className="browse-image-prev"
                          aria-label="上一张图片"
                          onPress={() => select(-1)}
                        >
                          <UiIcon icon={IconChevronLeft} size="action" />
                        </Button>
                      )}
                      {index < images.length - 1 && (
                        <Button
                          isIconOnly
                          size="lg"
                          variant="ghost"
                          className="browse-image-next"
                          aria-label="下一张图片"
                          onPress={() => select(1)}
                        >
                          <UiIcon icon={IconChevronRight} size="action" />
                        </Button>
                      )}
                    </>
                  )}
                  <div className="browse-image-close">
                    <DialogClose fullScreen label="关闭图片浏览" />
                  </div>
                </div>
              </section>
              <Toolbar className="browse-image-toolbar" aria-label="图片浏览工具" inert={!ready}>
                <Tooltip>
                  <Button
                    size="lg"
                    variant="ghost"
                    isIconOnly
                    aria-label="向左旋转"
                    onPress={() => {
                      setAngle((value) => value - 90);
                      setPan(origin);
                    }}
                  >
                    <UiIcon icon={IconRotate} size="action" />
                  </Button>
                  <Tooltip.Content>向左旋转</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Button
                    size="lg"
                    variant="ghost"
                    isIconOnly
                    aria-label="向右旋转"
                    onPress={() => {
                      setAngle((value) => value + 90);
                      setPan(origin);
                    }}
                  >
                    <UiIcon icon={IconRotateClockwise} size="action" />
                  </Button>
                  <Tooltip.Content>向右旋转</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Button
                    size="lg"
                    variant="ghost"
                    isIconOnly
                    aria-label="缩小图片"
                    isDisabled={zoom <= 25}
                    onPress={() => zoomTo(zoomGoal.current - 25)}
                  >
                    <UiIcon icon={IconZoomOut} size="action" />
                  </Button>
                  <Tooltip.Content>缩小</Tooltip.Content>
                </Tooltip>
                <output
                  className="browse-image-position"
                  aria-label="图片缩放比例"
                  aria-live="polite"
                >
                  {Math.round(zoom)}%
                </output>
                <Tooltip>
                  <Button
                    size="lg"
                    variant="ghost"
                    isIconOnly
                    aria-label="放大图片"
                    isDisabled={zoom >= 500}
                    onPress={() => zoomTo(zoomGoal.current + 25)}
                  >
                    <UiIcon icon={IconZoomIn} size="action" />
                  </Button>
                  <Tooltip.Content>放大</Tooltip.Content>
                </Tooltip>
              </Toolbar>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
