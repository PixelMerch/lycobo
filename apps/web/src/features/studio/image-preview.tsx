import { Button, Modal, Slider, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconPhoto,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import {
  lazy,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { copyToClipboard } from "../../lib/clipboard";
import { assetContentUrl, downloadAsset } from "./generation-client";
import { ReferenceThumbnails } from "./reference-thumbnails";
import { useStudioStore } from "./studio-state";
import "./fullscreen-dialog.css";
import "./image-preview.css";

const LocalRepair = lazy(() => import("./local-repair"));

export type PreviewImage = {
  id: string;
  publicId?: string | null | undefined;
  width: number | null;
  height: number | null;
  meta?: PreviewMeta;
};

export type PreviewMeta = {
  taskPublicId?: string | null | undefined;
  model?: string | null;
  createdAt?: string | null;
  prompt?: string | null;
  /** Asset IDs of the reference images used by the task. */
  references?: string[];
};

function CopyIconButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      isIconOnly
      variant="tertiary"
      className="image-preview-copy"
      aria-label={label}
      onPress={() => void copyToClipboard(value)}
    >
      <UiIcon icon={IconCopy} size="small" />
    </Button>
  );
}

/**
 * How far the scaled picture may travel before an edge would leave the frame.
 * Scale is a transform: the layout size stays at the fitted size, so the
 * overflow is measured from it and split evenly around the centre.
 */
function panLimits(frame: HTMLElement | null, picture: HTMLElement | null, scale: number) {
  if (!frame || !picture) return { x: 0, y: 0 };
  return {
    x: Math.max(0, (picture.offsetWidth * scale - frame.clientWidth) / 2),
    y: Math.max(0, (picture.offsetHeight * scale - frame.clientHeight) / 2),
  };
}

function clampPan(pan: { x: number; y: number }, limits: { x: number; y: number }) {
  return {
    x: Math.min(limits.x, Math.max(-limits.x, pan.x)),
    y: Math.min(limits.y, Math.max(-limits.y, pan.y)),
  };
}

/**
 * Full-screen image viewer: the picture on the left, its facts and prompt in the
 * middle, and the thumbnail list pinned to the right.
 */
export function ImagePreviewDialog({
  images: originalImages,
  meta: sharedMeta = {},
  initialIndex = 0,
  onClose,
}: {
  images: PreviewImage[];
  meta?: PreviewMeta;
  initialIndex?: number;
  onClose: () => void;
}) {
  const [addedImages, setAddedImages] = useState<PreviewImage[]>([]);
  const images = [
    ...originalImages,
    ...addedImages.filter((image) => !originalImages.some((value) => value.id === image.id)),
  ];
  const [repair, setRepair] = useState(false);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), images.length - 1));
  const [zoom, setZoom] = useState(100);
  const rail = useRef<HTMLElement>(null);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const active = images[index];
  const meta = active?.meta ?? sharedMeta;
  const multiple = images.length > 1;
  const zoomed = zoom > 100;
  const favorite = useStudioStore((s) => (active ? s.favorites.includes(active.id) : false));
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  // A new picture starts centred; reset the pan in the same batch as the
  // selection so the outgoing offset never reaches the next picture.
  const select = (next: number | ((current: number) => number)) => {
    setPan({ x: 0, y: 0 });
    setDragging(false);
    dragOrigin.current = null;
    setIndex(next);
  };
  const step = (delta: number) =>
    select((current) => (current + delta + images.length) % images.length);
  const activeId = active?.id;
  // Shrinking the zoom can leave the old offset beyond the new overflow.
  useEffect(() => {
    const limits = panLimits(frame.current, picture.current, zoom / 100);
    setPan((current) => {
      const next = clampPan(current, limits);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [zoom]);
  // Wheel zooms the picture; the listener must be non-passive to cancel scroll.
  useEffect(() => {
    const area = stage.current;
    if (repair || !area) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => Math.min(500, Math.max(100, current + (event.deltaY < 0 ? 10 : -10))));
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [repair]);
  // Keep the selected thumbnail in view as the viewer moves through the set.
  useEffect(() => {
    if (!activeId) return;
    const railElement = rail.current;
    const thumb = railElement?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!railElement || !thumb) return;
    const box = thumb.getBoundingClientRect();
    const bounds = railElement.getBoundingClientRect();
    if (box.top < bounds.top) railElement.scrollTop -= bounds.top - box.top;
    else if (box.bottom > bounds.bottom) railElement.scrollTop += box.bottom - bounds.bottom;
    if (box.left < bounds.left) railElement.scrollLeft -= bounds.left - box.left;
    else if (box.right > bounds.right) railElement.scrollLeft += box.right - bounds.right;
  }, [activeId]);
  if (!active) return null;
  const label = active.publicId ?? active.id.slice(0, 8);
  const size = active.width && active.height ? `${active.width} x ${active.height}` : "尺寸待同步";
  // Dragging only applies to a magnified picture: at 100% nothing is hidden
  // beyond the frame. Pointer capture keeps the pan alive beyond the stage.
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoomed || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const limits = panLimits(frame.current, picture.current, zoom / 100);
    setPan(
      clampPan(
        {
          x: origin.panX + event.clientX - origin.x,
          y: origin.panY + event.clientY - origin.y,
        },
        limits,
      ),
    );
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    dragOrigin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <Modal isOpen onOpenChange={(open) => (!open ? requestClose() : undefined)}>
      <Modal.Backdrop className="fullscreen-dialog__backdrop image-preview-backdrop">
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="image-preview-dialog" aria-label="图片预览">
            <motion.div className="image-preview" data-dialog-phase={phase} {...surfaceMotion}>
              {repair ? (
                <Suspense fallback={<p>正在打开局部修复…</p>}>
                  <LocalRepair
                    key={active.id}
                    source={active}
                    meta={meta}
                    onBack={() => {
                      setRepair(false);
                      requestAnimationFrame(() =>
                        document.getElementById("open-local-repair")?.focus(),
                      );
                    }}
                    onPreview={(image) => {
                      const existing = images.findIndex((value) => value.id === image.id);
                      if (existing >= 0) select(existing);
                      else {
                        setAddedImages((values) => [...values, image]);
                        select(images.length);
                      }
                      setRepair(false);
                    }}
                  />
                </Suspense>
              ) : (
                <>
                  <section className="image-preview-stage" aria-label="图片预览" ref={stage}>
                    {/* The frame clips the zoom so a magnified picture never covers the
                     * hint text or the bottom bar. */}
                    <div
                      className="image-preview-frame"
                      ref={frame}
                      data-zoomed={zoomed}
                      data-dragging={dragging}
                      onPointerDown={startPan}
                      onPointerMove={movePan}
                      onPointerUp={endPan}
                      onPointerCancel={endPan}
                      onLostPointerCapture={endPan}
                    >
                      <img
                        key={active.id}
                        ref={picture}
                        className="image-preview-image"
                        src={assetContentUrl(active.id)}
                        alt={meta.prompt || "生成图片"}
                        draggable={false}
                        style={{ scale: `${zoom / 100}`, translate: `${pan.x}px ${pan.y}px` }}
                        onLoad={() => {
                          const limits = panLimits(frame.current, picture.current, zoom / 100);
                          setPan((current) => clampPan(current, limits));
                        }}
                      />
                    </div>
                    {multiple && (
                      <>
                        <Button
                          isIconOnly
                          variant="tertiary"
                          className="image-preview-nav image-preview-prev"
                          aria-label="上一张"
                          onPress={() => step(-1)}
                        >
                          <UiIcon icon={IconChevronLeft} size="action" />
                        </Button>
                        <Button
                          isIconOnly
                          variant="tertiary"
                          className="image-preview-nav image-preview-next"
                          aria-label="下一张"
                          onPress={() => step(1)}
                        >
                          <UiIcon icon={IconChevronRight} size="action" />
                        </Button>
                      </>
                    )}
                    <p className="image-preview-hint">
                      使用滚轮或滑块缩放图片，放大后可拖动查看细节。
                    </p>
                  </section>
                  <aside className="image-preview-info" aria-label="图片信息">
                    <div className="image-preview-close-row">
                      <DialogClose label="关闭图片预览" className="image-preview-close" />
                    </div>
                    <header className="image-preview-head">
                      <span className="image-preview-model">
                        <UiIcon icon={IconPhoto} size="default" />
                        <span>{meta.model ?? "图片"}</span>
                      </span>
                      <span className="image-preview-tools">
                        <Tooltip delay={0}>
                          <ToggleButton
                            isIconOnly
                            variant="ghost"
                            className="image-preview-tool"
                            aria-label={favorite ? "取消收藏" : "收藏图片"}
                            isSelected={favorite}
                            onChange={() => toggleFavorite(active.id)}
                          >
                            <UiIcon icon={favorite ? IconStarFilled : IconStar} />
                          </ToggleButton>
                          <Tooltip.Content placement="top">
                            {favorite ? "取消收藏" : "收藏"}
                          </Tooltip.Content>
                        </Tooltip>
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            variant="tertiary"
                            className="image-preview-tool"
                            aria-label="下载原图"
                            onPress={() => downloadAsset(active.id)}
                          >
                            <UiIcon icon={IconDownload} />
                          </Button>
                          <Tooltip.Content placement="top">下载原图</Tooltip.Content>
                        </Tooltip>
                      </span>
                    </header>
                    <div className="image-preview-facts">
                      <span className="image-preview-fact-label">
                        ID：{meta.taskPublicId ?? "—"}
                      </span>
                      {meta.taskPublicId && (
                        <CopyIconButton
                          value={meta.taskPublicId}
                          label={`复制任务 ID ${meta.taskPublicId}`}
                        />
                      )}
                      {meta.createdAt && (
                        <time className="image-preview-time" dateTime={meta.createdAt}>
                          {new Date(meta.createdAt).toLocaleString("zh-CN", { hour12: false })}
                        </time>
                      )}
                    </div>
                    {meta.prompt && (
                      <section className="image-preview-section" aria-label="创意描述">
                        <h2>
                          <span>创意描述</span>
                          <CopyIconButton value={meta.prompt} label="复制创意描述" />
                        </h2>
                        <p>{meta.prompt}</p>
                      </section>
                    )}
                    {/* References reuse the history thumbnails; a task without any
                     * reference hides the whole section, title included. */}
                    {meta.references && meta.references.length > 0 && (
                      <section className="image-preview-section" aria-label="参考图">
                        <h2>
                          <span>参考图</span>
                        </h2>
                        <ReferenceThumbnails ids={meta.references} />
                      </section>
                    )}
                    <Button
                      id="open-local-repair"
                      variant="secondary"
                      size="sm"
                      onPress={() => setRepair(true)}
                    >
                      局部修复
                    </Button>
                  </aside>
                  <footer className="image-preview-bar">
                    <span className="image-preview-bar-id">Img ID：{label}</span>
                    <span className="image-preview-bar-size">{size}</span>
                    <Slider
                      className="image-preview-zoom"
                      aria-label="缩放"
                      minValue={100}
                      maxValue={500}
                      step={10}
                      value={zoom}
                      onChange={(value) => setZoom(Number(value))}
                    >
                      <Slider.Track>
                        <Slider.Fill />
                        <Slider.Thumb />
                      </Slider.Track>
                    </Slider>
                    <span className="image-preview-zoom-value">{zoom}%</span>
                  </footer>
                </>
              )}
              {/* Thumbnail rail stays on the far right so the image and its
               * details never shift while switching pictures. */}
              <nav className="image-preview-rail" aria-label="全部图片" ref={rail}>
                {images.map((image, position) => (
                  <Button
                    key={image.id}
                    variant="tertiary"
                    className="image-preview-thumb"
                    aria-label={`预览第 ${position + 1} 张`}
                    aria-current={position === index ? "true" : "false"}
                    onPress={() => select(position)}
                  >
                    <img
                      src={assetContentUrl(image.id, true)}
                      alt={`第 ${position + 1} 张缩略图`}
                      loading="lazy"
                    />
                  </Button>
                ))}
              </nav>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
