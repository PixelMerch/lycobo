import { Button, Link, Modal, Spinner } from "@heroui/react";
import { imageDeliverySchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { useErrorToast } from "../../lib/error-toast";
import { imageRequest } from "../generation/generation-client";
import "./video.css";
export function VideoPlayerDialog({
  assetId,
  title,
  onClose,
}: {
  assetId: string;
  title: string;
  onClose: () => void;
}) {
  const [playbackFailed, setPlaybackFailed] = useState(false);
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
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="video-preview-dialog" aria-label="视频预览">
            <Modal.Header className="video-preview-header">
              <Modal.Heading>{title}</Modal.Heading>
              <DialogClose label="关闭视频预览" />
            </Modal.Header>
            <Modal.Body className="video-preview-body">
              <div className="video-phone-shell">
                <div className="video-phone-screen">
                  {delivery.isPending && <Spinner aria-label="正在加载视频预览" />}
                  {(delivery.isError || playbackFailed) && (
                    <div className="video-preview-error">
                      <p>视频预览暂不可用</p>
                      <Button
                        onPress={() => {
                          setPlaybackFailed(false);
                          void delivery.refetch();
                        }}
                      >
                        重新加载
                      </Button>
                    </div>
                  )}
                  {delivery.data && !playbackFailed && (
                    // biome-ignore lint/a11y/useMediaCaption: generated videos have no subtitle-track metadata.
                    <video
                      className="video-player"
                      controls
                      controlsList="nodownload"
                      autoPlay
                      playsInline
                      preload="metadata"
                      src={delivery.data.url}
                      aria-label="生成视频"
                      onError={() => setPlaybackFailed(true)}
                    />
                  )}
                </div>
                <span className="video-phone-island" aria-hidden="true" />
                <span className="video-phone-home" aria-hidden="true" />
              </div>
              {delivery.data && (
                <Link className="button copy-prompt" href={delivery.data.download_url} download>
                  下载视频
                </Link>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
