import { IconMovie } from "@tabler/icons-react";
import { useMessages } from "../../../i18n/messages";
import { AssetPreviewDetails } from "../../assets/asset-preview-details";
import type { PreviewVideo } from "./video-player-dialog";
import { videoPlayerMessages } from "./video-player-messages";

/** 视频详情在共用信息栏里追加视频参数。 */
export function VideoPreviewDetails({ video }: { video: PreviewVideo }) {
  const t = useMessages(videoPlayerMessages);
  return (
    <AssetPreviewDetails asset={video} icon={IconMovie} title={t.videoTool} labels={t}>
      {video.params && video.params.length > 0 && (
        <section className="image-preview-section" aria-label={t.params}>
          <h2>
            <span>{t.params}</span>
          </h2>
          <dl className="video-preview-params">
            {video.params.map((param) => (
              <div key={param.label}>
                <dt>{param.label}</dt>
                <dd>{param.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </AssetPreviewDetails>
  );
}
