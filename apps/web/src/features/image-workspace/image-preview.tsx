import { Modal } from "@heroui/react";
import { motion } from "motion/react";
import type { RefObject } from "react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { DialogClose } from "../../components/overlays/dialog-close";
import { useCenteredDialogMotion } from "../../components/overlays/use-centered-dialog-motion";
import { useImageSession } from "../generation/generation-client";
import { ImagePreviewRail } from "./image-preview-rail";
import { repairDraftKey, useRepairDrafts } from "./local-edit/local-repair-state";
import "../../styles/fullscreen-dialog.css";
import "./image-preview.css";
import { useMessages } from "../../i18n/messages";
import { imageWorkspaceMessages } from "./image-workspace-messages";

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
  /** The image's own ID; only 素材库 previews show it, history shows the task ID alone. */
  imagePublicId?: string | null | undefined;
};

/** 展示图片详情与局部编辑，关闭时保护未提交的修改。 */
export function ImagePreviewDialog({
  images: originalImages,
  meta: sharedMeta = {},
  initialIndex = 0,
  onClose,
  hasMore = false,
  isLoadingMore = false,
  isLoadMoreError = false,
  onLoadMore,
  onViewHistory,
}: {
  images: PreviewImage[];
  meta?: PreviewMeta;
  initialIndex?: number;
  onClose: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isLoadMoreError?: boolean;
  onLoadMore?: () => Promise<unknown>;
  onViewHistory?: () => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  const images = originalImages;
  const navigate = useNavigate();
  const historyTask = useRef<string | null>(null);
  const [repair, setRepair] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(() => {
    onClose();
    if (historyTask.current) {
      onViewHistory?.();
      void navigate(`/commerce/create?task=${encodeURIComponent(historyTask.current)}`);
    }
  });
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), images.length - 1));
  const surface = useRef<HTMLDivElement>(null);
  const active = images[index];
  const meta = active?.meta ?? sharedMeta;
  const session = useImageSession();
  const draftKey = active ? repairDraftKey(session.data, active.id) : "";
  // 有未提交编辑区域时，关闭或 Escape 必须先确认，不能静默丢弃。
  const editingDraft = useRepairDrafts((state) =>
    draftKey ? (state.drafts[draftKey]?.regions.length ?? 0) : 0,
  );
  const needsExitConfirm = repair && editingDraft > 0;
  const select = useCallback((next: number | ((current: number) => number)) => setIndex(next), []);
  usePreviewRailKeyboard(surface, index, images.length, repair, select);
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
          <Modal.Dialog className="image-preview-dialog" aria-label={t.preview}>
            <motion.div
              ref={surface}
              className="image-preview"
              data-dialog-phase={phase}
              {...surfaceMotion}
            >
              <Suspense
                fallback={
                  <div className="preview-workspace-loading" role="status">
                    {t.openingCanvas}
                    <DialogClose
                      fullScreen
                      label={t.closePreview}
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
              {/* 缩略图固定在最右侧，切换图片时主图与详情位置保持稳定。 */}
              <ImagePreviewRail
                images={images}
                index={index}
                onSelect={select}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                isLoadMoreError={isLoadMoreError}
                onLoadMore={onLoadMore}
              />
            </motion.div>
            <ConfirmDialog
              isOpen={exitConfirm}
              title={t.exitTitle}
              content={t.exitContent}
              closeLabel={t.closeExit}
              onCancel={() => setExitConfirm(false)}
              onConfirm={discardAndClose}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function usePreviewRailKeyboard(
  surface: RefObject<HTMLDivElement | null>,
  index: number,
  count: number,
  repair: boolean,
  select: (index: number) => void,
) {
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
      const next = (index + direction + count) % count;
      select(next);
      if (target.closest(".image-preview-rail")) {
        dialog
          .querySelectorAll<HTMLButtonElement>(".image-preview-thumb")
          [next]?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, count, repair, select, surface]);
}
