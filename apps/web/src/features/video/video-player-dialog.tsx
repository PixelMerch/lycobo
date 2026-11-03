import { Link, Modal } from "@heroui/react";
import { imageDeliverySchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
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
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <DialogClose label="关闭视频预览" />
            </Modal.Header>
            <Modal.Body>
              {delivery.data && (
                <>
                  {/* biome-ignore lint/a11y/useMediaCaption: generated videos have no subtitle-track metadata. */}
                  <video
                    className="video-player"
                    controls
                    playsInline
                    preload="metadata"
                    src={delivery.data.url}
                    aria-label="生成视频"
                  />
                  <Link href={delivery.data.download_url} download>
                    下载视频
                  </Link>
                </>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
