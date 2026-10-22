import { Modal } from "@heroui/react";
import { motion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { DialogClose } from "../../components/dialog-close";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { useImageSession } from "../generation/generation-client";
import { ImagePreviewRail } from "./image-preview-rail";
import { repairDraftKey, useRepairDrafts } from "./local-edit/local-repair-state";
import "../../styles/fullscreen-dialog.css";
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
  taskId?: string;
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
  onViewHistory,
}: {
  images: PreviewImage[];
  meta?: PreviewMeta;
  initialIndex?: number;
  onClose: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onViewHistory?: () => void;
}) {
  const images = originalImages;
  const navigate = useNavigate();
  const historyTask = useRef<string | null>(null);
  const [repair, setRepair] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(() => {
    onClose();
    if (historyTask.current) {
      onViewHistory?.();
      void navigate(`/create?task=${encodeURIComponent(historyTask.current)}`);
    }
  });
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), images.length - 1));
  const surface = useRef<HTMLDivElement>(null);
  const active = images[index];
  const meta = active?.meta ?? sharedMeta;
  const session = useImageSession();
  const draftKey = active ? repairDraftKey(session.data, active.id) : "";
  /* Closing while the editor holds unsubmitted regions must not silently throw
   * them away, so the modal close and Escape ask first. */
  const editingDraft = useRepairDrafts((state) =>
    draftKey ? (state.drafts[draftKey]?.regions.length ?? 0) : 0,
  );
  const needsExitConfirm = repair && editingDraft > 0;
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
  const discardAndClose = () => {
    setExitConfirm(false);
    if (draftKey) useRepairDrafts.getState().clear(draftKey);
    setRepair(false);
    requestClose();
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (open) return;
        if (needsExitConfirm) {
          setExitConfirm(true);
          return;
        }
        requestClose();
      }}
    >
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
                    if (!image.meta?.taskId) return;
                    historyTask.current = image.meta.taskId;
                    setRepair(false);
                    requestClose();
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
            <ConfirmDialog
              isOpen={exitConfirm}
              title="退出局部编辑？"
              content="当前选区和修改说明不会保存，退出后会清空。"
              closeLabel="关闭退出确认"
              onCancel={() => setExitConfirm(false)}
              onConfirm={discardAndClose}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
