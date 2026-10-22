import { Modal } from "@heroui/react";
import { motion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { ImagePreviewRail } from "./image-preview-rail";
import "./fullscreen-dialog.css";
import "./image-preview.css";

const PreviewWorkspace = lazy(() => import("./preview-workspace"));

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

export function ImagePreviewDialog({
  images: originalImages,
  meta: sharedMeta = {},
  initialIndex = 0,
  onClose,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  images: PreviewImage[];
  meta?: PreviewMeta;
  initialIndex?: number;
  onClose: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [addedImages, setAddedImages] = useState<PreviewImage[]>([]);
  const images = [
    ...originalImages,
    ...addedImages.filter((image) => !originalImages.some((value) => value.id === image.id)),
  ];
  const [repair, setRepair] = useState(false);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), images.length - 1));
  const surface = useRef<HTMLDivElement>(null);
  const active = images[index];
  const meta = active?.meta ?? sharedMeta;
  const select = useCallback((next: number | ((current: number) => number)) => setIndex(next), []);
  useEffect(() => {
    const dialog = surface.current?.closest('[role="dialog"]');
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = {
        ArrowLeft: -1,
        ArrowUp: -1,
        ArrowRight: 1,
        ArrowDown: 1,
      }[event.key];
      const target = event.target;
      if (
        (repair &&
          !(event.target instanceof HTMLElement && event.target.closest(".image-preview-rail"))) ||
        !direction ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !(target instanceof HTMLElement) ||
        target.closest('[role="dialog"]') !== dialog ||
        target.closest(
          'input, textarea, select, .preview-canvas-toolbar, [contenteditable="true"], [role="slider"], [role="textbox"], [role="combobox"], [role="spinbutton"]',
        )
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      const next = (index + direction + images.length) % images.length;
      select(next);
      if (target.closest(".image-preview-rail")) {
        dialog
          .querySelectorAll<HTMLButtonElement>(".image-preview-thumb")
          [next]?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, images.length, repair, select]);
  if (!active) return null;
  return (
    <Modal isOpen onOpenChange={(open) => (!open ? requestClose() : undefined)}>
      <Modal.Backdrop className="fullscreen-dialog__backdrop image-preview-backdrop">
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="image-preview-dialog" aria-label="图片预览">
            <motion.div
              ref={surface}
              className="image-preview"
              data-dialog-phase={phase}
              {...surfaceMotion}
            >
              <Suspense
                fallback={
                  <div className="preview-workspace-loading" role="status">
                    正在打开图片画布…
                    <DialogClose
                      fullScreen
                      label="关闭图片预览"
                      className="preview-loading-close"
                    />
                  </div>
                }
              >
                <PreviewWorkspace
                  key={active.id}
                  source={active}
                  meta={meta}
                  repairing={repair}
                  onRepairChange={setRepair}
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
              {/* Thumbnail rail stays on the far right so the image and its
               * details never shift while switching pictures. */}
              <ImagePreviewRail
                images={images}
                index={index}
                onSelect={select}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
              />
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
