import { Button, Spinner } from "@heroui/react";
import { IconMovie, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { type CSSProperties, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import { formatVideoTime } from "./use-video-playback";
import { VideoPlayerDialog } from "./video-player-dialog";

/** Lists load a private still image; only opening the dialog requests the video. */
export function VideoCover({
  assetId,
  title,
  ratio,
  seconds,
  meta,
}: {
  assetId: string;
  title: string;
  ratio: string;
  seconds: number;
  meta: string[];
}) {
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
        aria-label={`预览视频：${title}`}
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
            alt={`${title}视频封面`}
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
        {failed && <span className="video-cover-caption">封面暂不可用，点击预览视频</span>}
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
          重试封面
        </Button>
      )}
      {open && (
        <VideoPlayerDialog
          assetId={assetId}
          title={title}
          aspect={aspect}
          seconds={seconds}
          meta={meta}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
