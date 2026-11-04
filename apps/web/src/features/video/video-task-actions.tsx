import { Button, Link, Tooltip } from "@heroui/react";
import { type VideoTask, videoUnitCredits } from "@lycoboai/contracts";
import { IconDownload, IconEdit, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { assetContentUrl } from "../generation/generation-client";
import { useSubmitVideo, useVideoModel } from "./video-client";

export function VideoDownloadLink({ url }: { url: string }) {
  return (
    <Link className="button copy-prompt" href={url} download>
      <UiIcon icon={IconDownload} size="small" />
      下载视频
    </Link>
  );
}

export function VideoTaskActions({
  task,
  onEdit,
  showDownload,
}: {
  task: VideoTask;
  onEdit: () => void;
  showDownload: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const actions = actionsRef.current;
    const article = actions?.closest<HTMLElement>(".generation-job");
    if (!actions || !article) return;
    const measure = () =>
      article.style.setProperty(
        "--history-actions-width",
        `${actions.getBoundingClientRect().width}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(actions);
    measure();
    return () => {
      observer.disconnect();
      article.style.removeProperty("--history-actions-width");
    };
  }, []);
  const submission = useSubmitVideo();
  const model = useVideoModel();
  useErrorToast(submission.error?.message);
  const canRegenerate =
    (task.status === "succeeded" || task.status === "failed") &&
    model.data?.enabled &&
    !submission.isPending &&
    !submission.hasPending &&
    !submission.blockedByPending;
  return (
    <div ref={actionsRef} className="history-task-actions">
      {showDownload && task.delivery && <VideoDownloadLink url={task.delivery.download_url} />}
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="tertiary"
          className="history-icon-action"
          aria-label="重新编辑"
          onPress={onEdit}
        >
          <UiIcon icon={IconEdit} size="action" />
        </Button>
        <Tooltip.Content placement="bottom">重新编辑</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="tertiary"
          className="history-icon-action"
          aria-label="重新生成"
          isDisabled={!canRegenerate}
          onPress={() => setConfirm(true)}
        >
          <UiIcon icon={IconRefresh} size="action" />
        </Button>
        <Tooltip.Content placement="bottom">重新生成</Tooltip.Content>
      </Tooltip>
      <ConfirmDialog
        isOpen={confirm}
        title="重新生成这个视频？"
        content={`本次消耗 ${videoUnitCredits} 积分`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (!canRegenerate) return;
          const input = task.input.video;
          submission.submit({
            input: { prompt: input.prompt, seconds: input.seconds, aspectRatio: input.aspectRatio },
            references: input.referenceAssetIds.map((id, index) => ({
              id,
              assetId: id,
              name: `图片${index + 1}`,
              src: assetContentUrl(id, true),
            })),
            clearDraft: false,
          });
        }}
      />
    </div>
  );
}
