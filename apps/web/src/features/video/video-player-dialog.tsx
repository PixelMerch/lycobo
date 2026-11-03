import { Link, Modal } from "@heroui/react";
import { imageDeliverySchema } from "@lycoboai/contracts";
import { IconDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useRef } from "react";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { useErrorToast } from "../../lib/error-toast";
import { imageRequest } from "../generation/generation-client";
import { VideoPlayer } from "./video-player";
// The preview shares the image browser's dim-and-blur layer and centred grow motion.
import "../../components/image-viewer.css";
import "./video.css";

export function VideoPlayerDialog({
  assetId,
  title,
  aspect = 9 / 16,
  seconds,
  meta = [],
  onClose,
}: {
  assetId: string;
  title: string;
  /** Known width / height, so the frame keeps its shape before the media loads. */
  aspect?: number;
  seconds?: number;
  meta?: string[];
  onClose: () => void;
}) {
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const dismissStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const delivery = useQuery({
    queryKey: ["video-delivery", assetId],
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await (
        await imageRequest(`image-assets/${assetId}/delivery`, { signal })
      ).json();
      return imageDeliverySchema.parse(response.delivery);
    },
  });
  useErrorToast(delivery.error?.message);
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className="browse-image-backdrop" data-dialog-phase={phase}>
        <Modal.Container size="full" className="browse-image-container">
          <Modal.Dialog aria-label="视频预览" className="browse-image-dialog video-preview-dialog">
            <motion.div className="video-preview-layout" {...surfaceMotion}>
              <header className="video-preview-header">
                <div className="video-preview-heading">
                  <Modal.Heading className="video-preview-title">{title}</Modal.Heading>
                  {meta.length > 0 && (
                    <p className="video-preview-meta">
                      {meta.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </p>
                  )}
                </div>
                {delivery.data && (
                  <Link
                    className="button video-preview-download"
                    href={delivery.data.download_url}
                    download
                  >
                    <UiIcon icon={IconDownload} />
                    下载视频
                  </Link>
                )}
                <DialogClose fullScreen label="关闭视频预览" />
              </header>
              {/* Pressing the empty stage around the frame dismisses, as in the image browser. */}
              <div
                className="video-preview-stage"
                onPointerDown={(event) => {
                  dismissStart.current =
                    event.button === 0 && event.target === event.currentTarget
                      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
                      : null;
                }}
                onPointerUp={(event) => {
                  const start = dismissStart.current;
                  dismissStart.current = null;
                  if (
                    start?.id === event.pointerId &&
                    event.target === event.currentTarget &&
                    Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4
                  )
                    requestClose();
                }}
                onPointerCancel={() => {
                  dismissStart.current = null;
                }}
              >
                <VideoPlayer
                  assetId={assetId}
                  title={title}
                  src={delivery.data?.url}
                  unavailable={delivery.isError}
                  aspect={aspect}
                  seconds={seconds}
                  onRetry={() => void delivery.refetch()}
                />
              </div>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
