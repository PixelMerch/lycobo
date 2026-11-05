import { Modal } from "@heroui/react";
import { imageDeliverySchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { useErrorToast } from "../../lib/error-toast";
import { imageRequest } from "../generation/generation-client";
import { ImagePreviewRail } from "../image-workspace/image-preview-rail";
import { PreviewDotGrid } from "../image-workspace/preview-dot-grid";
import { VideoPlayer } from "./video-player";
import { VideoPreviewDetails } from "./video-preview-details";
import "../../styles/fullscreen-dialog.css";
import "../image-workspace/image-preview.css";
import "../image-workspace/preview-workspace.css";
import "./video.css";

export type PreviewVideo = {
  /** Asset id: covers, delivery and favorites all key on it. */
  id: string;
  /** Known width / height, so the frame keeps its shape before the media loads. */
  aspect: number;
  seconds?: number | undefined;
  taskPublicId?: string | null | undefined;
  createdAt?: string | null | undefined;
  prompt?: string | null | undefined;
  references?: string[] | undefined;
  params?: { label: string; value: string }[] | undefined;
};

/** Remounted per video, so each one signs its own link and starts from a fresh player. */
function VideoPreviewStage({ video }: { video: PreviewVideo }) {
  const stage = useRef<HTMLElement>(null);
  const delivery = useQuery({
    queryKey: ["video-delivery", video.id],
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await (
        await imageRequest(`image-assets/${video.id}/delivery`, { signal })
      ).json();
      return imageDeliverySchema.parse(response.delivery);
    },
  });
  useErrorToast(delivery.error?.message);
  return (
    <section
      ref={stage}
      className="image-preview-stage preview-dot-surface video-preview-stage"
      aria-label="视频画面"
    >
      <PreviewDotGrid stage={stage} />
      <VideoPlayer
        assetId={video.id}
        title={video.taskPublicId ?? "视频预览"}
        src={delivery.data?.url}
        unavailable={delivery.isError}
        aspect={video.aspect}
        seconds={video.seconds}
        onRetry={() => void delivery.refetch()}
      />
    </section>
  );
}

/** Same three columns as the image detail: stage, information and the full thumbnail rail. */
function railDirection(key: string, inRail: boolean) {
  if (key === "ArrowUp" || (inRail && key === "ArrowLeft")) return -1;
  if (key === "ArrowDown" || (inRail && key === "ArrowRight")) return 1;
  return 0;
}

function ignoreRailKey(event: KeyboardEvent, target: HTMLElement) {
  return event.altKey || event.ctrlKey || event.metaKey || target.closest("input, textarea");
}

export function VideoPlayerDialog({
  videos,
  initialId,
  onClose,
  hasMore = false,
  isLoadingMore = false,
  isLoadMoreError = false,
  onLoadMore,
}: {
  videos: PreviewVideo[];
  initialId: string;
  onClose: () => void;
  hasMore?: boolean | undefined;
  isLoadingMore?: boolean | undefined;
  isLoadMoreError?: boolean | undefined;
  onLoadMore?: (() => Promise<unknown>) | undefined;
}) {
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const surface = useRef<HTMLDivElement>(null);
  // Tracked by id: a task finishing while this is open must not change the selection.
  const [activeId, setActiveId] = useState(initialId);
  const index = Math.max(
    videos.findIndex((video) => video.id === activeId),
    0,
  );
  const active = videos[index];
  // Up and down walk the rail. Left and right seek, unless the rail itself has focus.
  useEffect(() => {
    const dialog = surface.current?.closest('[role="dialog"]');
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest('[role="dialog"]') !== dialog) return;
      const inRail = !!target.closest(".image-preview-rail");
      const direction = railDirection(event.key, inRail);
      if (!direction || ignoreRailKey(event, target)) return;
      event.preventDefault();
      event.stopPropagation();
      const next = (index + direction + videos.length) % videos.length;
      const video = videos[next];
      if (video) setActiveId(video.id);
      if (inRail)
        dialog
          .querySelectorAll<HTMLButtonElement>(".image-preview-thumb")
          [next]?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, videos]);
  if (!active) return null;
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className="fullscreen-dialog__backdrop image-preview-backdrop">
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="image-preview-dialog" aria-label="视频预览">
            <motion.div
              ref={surface}
              className="image-preview"
              data-dialog-phase={phase}
              {...surfaceMotion}
            >
              <VideoPreviewStage key={active.id} video={active} />
              <VideoPreviewDetails video={active} />
              <ImagePreviewRail
                kind="video"
                images={videos}
                index={index}
                onSelect={(position) => {
                  const video = videos[position];
                  if (video) setActiveId(video.id);
                }}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                isLoadMoreError={isLoadMoreError}
                onLoadMore={onLoadMore}
              />
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
