import { Button, Spinner } from "@heroui/react";
import { IconMovie, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { type CSSProperties, lazy, Suspense, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";

const VideoPlayerDialog = lazy(() =>
  import("./video-player-dialog").then((module) => ({ default: module.VideoPlayerDialog })),
);
/** Lists load a private still image; only opening the dialog requests the smaller video. */
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
            <UiIcon icon={failed ? IconMovie : IconPlayerPlay} size="illustration" />
          )}
        </span>
        <span className="video-cover-caption">{failed ? "点击预览视频" : "点击预览"}</span>
        <span className="video-cover-duration">{seconds}秒</span>
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
        <Suspense fallback={<Spinner aria-label="正在打开视频预览" />}>
          <VideoPlayerDialog assetId={assetId} title={title} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
