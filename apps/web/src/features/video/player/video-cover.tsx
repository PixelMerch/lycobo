import { Button, Spinner } from "@heroui/react";
import { IconMovie, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { type CSSProperties, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { AssetImage } from "../../generation/asset-image";
import { VideoHistoryPreview } from "../history/video-history-preview";
import { formatVideoTime } from "./use-video-playback";
import { videoPlayerMessages } from "./video-player-messages";

/** 视频封面：列表只加载私有封面图，打开弹窗时才请求视频本身。 */
export function VideoCover({
  assetId,
  title,
  ratio,
  seconds,
}: {
  assetId: string;
  title: string;
  ratio: string;
  seconds: number;
}) {
  const t = useMessages(videoPlayerMessages);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
  const [width, height] = ratio.split(":").map(Number);
  const aspect = measuredRatio ?? (width && height ? width / height : 9 / 16);
  const coverStyle: CSSProperties & { "--video-cover-aspect": number } = {
    aspectRatio: String(aspect),
    "--video-cover-aspect": aspect,
  };
  return (
    <>
      <Button
        variant="ghost"
        className="video-cover"
        aria-label={t.previewVideo(title)}
        data-cover-loaded={loaded || undefined}
        data-cover-failed={failed || undefined}
        style={coverStyle}
        onPress={() => setOpen(true)}
      >
        {!failed && (
          <AssetImage
            key={attempt}
            assetId={assetId}
            thumbnail
            alt={t.coverAlt(title)}
            loading="lazy"
            className="video-cover-image"
            onLoad={(event) => {
              setLoaded(true);
              setMeasuredRatio(
                event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
              );
            }}
            onError={() => {
              setFailed(true);
              setLoaded(false);
            }}
          />
        )}
        <span className="video-cover-play" aria-hidden="true">
          {!loaded && !failed ? (
            <Spinner size="sm" color="current" />
          ) : (
            <UiIcon icon={failed ? IconMovie : IconPlayerPlayFilled} size="navigation" />
          )}
        </span>
        {failed && <span className="video-cover-caption">{t.coverUnavailable}</span>}
        <span className="video-cover-duration">{formatVideoTime(seconds)}</span>
      </Button>
      {failed && (
        <Button
          variant="ghost"
          size="sm"
          className="video-cover-retry"
          onPress={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          <UiIcon icon={IconRefresh} size="small" />
          {t.retryCover}
        </Button>
      )}
      {open && <VideoHistoryPreview assetId={assetId} onClose={() => setOpen(false)} />}
    </>
  );
}
