import { Button, Modal, Spinner, Toolbar, Tooltip } from "@heroui/react";
import { IconRotate, IconRotateClockwise, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useErrorToast } from "../lib/error-toast";
import { DialogClose } from "./dialog-close";
import { easedImageZoom, imageWheelFactor } from "./image-zoom-motion";
import { UiIcon } from "./ui-icon";
import { useCenteredDialogMotion } from "./use-centered-dialog-motion";
import "./image-viewer.css";

export type ViewerImage = { src: string; thumbnailSrc?: string; alt: string };
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
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbnailRail = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const reveal = () =>
      thumbnails.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    reveal();
    const rail = thumbnailRail.current;
    if (!rail) return;
    const observer = new ResizeObserver(reveal);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [index]);
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
  const loadingFocus = useRef<HTMLElement | null>(null);
  const [animated, setAnimated] = useState(false);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const dismissStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const drag = useRef<{ pointer: Point; pan: Point } | null>(null);
  const wheelZoom = useRef<(delta: number, ctrlKey?: boolean) => void>(() => {});
  const ready = loadedSrc === active?.src && viewport.width > 1 && viewport.height > 1;
  useEffect(() => {
    if (!ready) return;
    const target = loadingFocus.current;
    loadingFocus.current = null;
    if (target?.isConnected && document.activeElement === document.body)
      target.focus({ preventScroll: true });
  }, [ready]);
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
      const next = easedImageZoom(current, goal, elapsed);
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
    ? (delta, ctrlKey) => zoomBy(imageWheelFactor(delta, ctrlKey))
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
      wheelZoom.current(event.deltaY, event.ctrlKey);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      element.removeEventListener("wheel", wheel);
    };
  }, [area]);
  useErrorToast(failed ? "图片加载失败，请关闭后重新打开。" : null);
  const select = (next: number) => {
    if (next === index || next < 0 || next >= images.length) return;
    const focused = document.activeElement;
    loadingFocus.current =
      focused instanceof HTMLElement && focused.closest(".browse-image-toolbar") ? focused : null;
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
          <Modal.Dialog
            aria-label="图片浏览"
            className="browse-image-dialog"
            onPointerDown={(event) => {
              dismissStart.current =
                event.button === 0 &&
                event.target instanceof Element &&
                !event.target.closest(
                  "button, .browse-image-picture, .browse-image-thumbnails, .browse-image-toolbar",
                )
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
                !event.target.closest(
                  "button, .browse-image-picture, .browse-image-thumbnails, .browse-image-toolbar",
                )
              )
                requestClose();
            }}
            onPointerCancel={() => {
              dismissStart.current = null;
            }}
          >
            <motion.div
              className="browse-image-surface"
              data-ready={ready}
              data-multiple={images.length > 1}
              {...surfaceMotion}
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
                const inThumbnails =
                  event.target instanceof Element &&
                  !!event.target.closest(".browse-image-thumbnails");
                const backwards =
                  event.key === "ArrowLeft" || (inThumbnails && event.key === "ArrowUp");
                const forwards =
                  event.key === "ArrowRight" || (inThumbnails && event.key === "ArrowDown");
                if (!backwards && !forwards) return;
                event.preventDefault();
                event.stopPropagation();
                const next = index + (backwards ? -1 : 1);
                select(next);
                if (inThumbnails) thumbnails.current[next]?.focus({ preventScroll: true });
              }}
            >
              <div className="browse-image-main">
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
              </div>
              {images.length > 1 && (
                <nav ref={thumbnailRail} className="browse-image-thumbnails" aria-label="本组图片">
                  {images.map((image, position) => (
                    <Button
                      key={`${image.src}-${image.alt}`}
                      ref={(element) => {
                        thumbnails.current[position] = element;
                      }}
                      variant="ghost"
                      className="browse-image-thumbnail"
                      aria-label={`查看第 ${position + 1} 张图片`}
                      aria-current={position === index}
                      onPress={() => select(position)}
                    >
                      <span className="browse-image-thumbnail-clip">
                        <img
                          src={image.thumbnailSrc ?? image.src}
                          alt=""
                          loading="lazy"
                          crossOrigin="anonymous"
                          referrerPolicy="strict-origin-when-cross-origin"
                          draggable={false}
                        />
                      </span>
                    </Button>
                  ))}
                </nav>
              )}
              <div className="browse-image-close">
                <DialogClose fullScreen label="关闭图片浏览" />
              </div>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
