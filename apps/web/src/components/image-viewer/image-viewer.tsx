import { Button, Modal } from "@heroui/react";
import { motion } from "motion/react";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { DialogClose } from "../overlays/dialog-close";
import { useCenteredDialogEntrance } from "../overlays/use-centered-dialog-entrance";
import "./image-viewer.css";

import { useMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";
import { ImageViewerStage, useImageViewerStage, type ViewerImage } from "./image-viewer-stage";
import { ImageViewerToolbar } from "./image-viewer-toolbar";

export type { ViewerImage } from "./image-viewer-stage";

/** 只读的共用图片浏览器：调用方提供图片地址，并保持打开它的入口挂载。 */
export function ImageViewer({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: ViewerImage[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const t = useMessages(componentsMessages);
  const surfaceMotion = useCenteredDialogEntrance();
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
  const backdropDismiss = useBackdropDismiss(onClose);
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
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="browse-image-backdrop" {...backdropDismiss}>
        <Modal.Container size="full" className="browse-image-container">
          <Modal.Dialog aria-label={t.viewer} className="browse-image-dialog">
            <motion.div
              className="browse-image-surface"
              data-ready={ready}
              data-multiple={images.length > 1}
              {...surfaceMotion}
              onKeyDownCapture={(event) => {
                /* 方向键始终用来切换图片，焦点在工具栏上也一样，
                 * 不让工具栏移动自己的焦点环。 */
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
                <DialogClose fullScreen label={t.closeViewer} />
              </div>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const interactiveParts =
  "button, .browse-image-picture, .browse-image-thumbnails, .browse-image-toolbar";

// 在图片以外的空白处轻点（按下与松开几乎同一位置）才关闭浏览器，拖动或点在图片、工具上都不关闭。
function useBackdropDismiss(onClose: () => void) {
  const dismissStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const onBlank = (target: EventTarget) =>
    target instanceof Element && !target.closest(interactiveParts);
  return {
    onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
      dismissStart.current =
        event.button === 0 && onBlank(event.target)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    },
    onPointerUpCapture: (event: PointerEvent<HTMLElement>) => {
      const start = dismissStart.current;
      dismissStart.current = null;
      if (
        start &&
        start.id === event.pointerId &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4 &&
        onBlank(event.target)
      )
        onClose();
    },
    onPointerCancelCapture: () => {
      dismissStart.current = null;
    },
  };
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
  const t = useMessages(componentsMessages);
  return (
    <nav ref={thumbnailRail} className="browse-image-thumbnails" aria-label={t.groupImages}>
      {images.map((image, position) => (
        <Button
          key={`${image.src}-${image.alt}`}
          ref={(element) => {
            thumbnails.current[position] = element;
          }}
          variant="ghost"
          className="browse-image-thumbnail"
          aria-label={t.viewNumbered(position + 1)}
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
