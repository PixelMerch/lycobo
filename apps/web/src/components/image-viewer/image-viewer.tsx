import { Button, Modal } from "@heroui/react";
import { motion } from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { DialogClose } from "../overlays/dialog-close";
import { useCenteredDialogMotion } from "../overlays/use-centered-dialog-motion";
import "./image-viewer.css";

import { ImageViewerStage, useImageViewerStage, type ViewerImage } from "./image-viewer-stage";
import { ImageViewerToolbar } from "./image-viewer-toolbar";

export type { ViewerImage } from "./image-viewer-stage";

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
  const stage = useImageViewerStage(active);
  const { ready, zoom, rotate, zoomStep, reset } = stage;
  const loadingFocus = useRef<HTMLElement | null>(null);
  const dismissStart = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const target = loadingFocus.current;
    loadingFocus.current = null;
    if (target?.isConnected && document.activeElement === document.body)
      target.focus({ preventScroll: true });
  }, [ready]);
  const select = (next: number) => {
    if (next === index || next < 0 || next >= images.length) return;
    const focused = document.activeElement;
    loadingFocus.current =
      focused instanceof HTMLElement && focused.closest(".browse-image-toolbar") ? focused : null;
    reset();
    setIndex(next);
  };
  if (!active) return null;
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop
        className="browse-image-backdrop"
        data-dialog-phase={phase}
        onPointerDownCapture={(event) => {
          dismissStart.current =
            event.button === 0 &&
            event.target instanceof Element &&
            !event.target.closest(
              "button, .browse-image-picture, .browse-image-thumbnails, .browse-image-toolbar",
            )
              ? { id: event.pointerId, x: event.clientX, y: event.clientY }
              : null;
        }}
        onPointerUpCapture={(event) => {
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
        onPointerCancelCapture={() => {
          dismissStart.current = null;
        }}
      >
        <Modal.Container size="full" className="browse-image-container">
          <Modal.Dialog aria-label="图片浏览" className="browse-image-dialog">
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
                <ImageViewerStage active={active} stage={stage} />
                <ImageViewerToolbar ready={ready} zoom={zoom} rotate={rotate} zoomStep={zoomStep} />
              </div>
              {images.length > 1 && (
                <ImageViewerThumbnails
                  images={images}
                  index={index}
                  select={select}
                  thumbnails={thumbnails}
                  thumbnailRail={thumbnailRail}
                />
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

function ImageViewerThumbnails({
  images,
  index,
  select,
  thumbnails,
  thumbnailRail,
}: {
  images: ViewerImage[];
  index: number;
  select: (index: number) => void;
  thumbnails: RefObject<(HTMLButtonElement | null)[]>;
  thumbnailRail: RefObject<HTMLElement | null>;
}) {
  return (
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
  );
}
