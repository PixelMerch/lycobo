import { Button, Link, Tooltip } from "@heroui/react";
import { type VideoTask, videoUnitCredits } from "@lycoboai/contracts";
import { IconDownload, IconEdit, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { assetContentUrl } from "../../generation/generation-client";
import { useSubmitVideo, useVideoModel } from "../video-client";
import { videoHistoryMessages } from "./video-history-messages";

/** 视频任务的操作：下载、重新编辑与重新生成。 */
export function VideoTaskActions({ task, onEdit }: { task: VideoTask; onEdit: () => void }) {
  const t = useMessages(videoHistoryMessages);
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
      {task.delivery && (
        <Link className="button copy-prompt" href={task.delivery.download_url} download>
          <UiIcon icon={IconDownload} size="small" />
          {t.downloadVideo}
        </Link>
      )}
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="tertiary"
          className="history-icon-action"
          aria-label={t.edit}
          onPress={onEdit}
        >
          <UiIcon icon={IconEdit} size="action" />
        </Button>
        <Tooltip.Content placement="bottom">{t.edit}</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="tertiary"
          className="history-icon-action"
          aria-label={t.regenerate}
          isDisabled={!canRegenerate}
          onPress={() => setConfirm(true)}
        >
          <UiIcon icon={IconRefresh} size="action" />
        </Button>
        <Tooltip.Content placement="bottom">{t.regenerate}</Tooltip.Content>
      </Tooltip>
      <ConfirmDialog
        isOpen={confirm}
        title={t.regenerateTitle}
        content={t.regenerateCost(videoUnitCredits)}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (!canRegenerate) return;
          const input = task.input.video;
          submission.submit({
            input: {
              prompt: input.prompt,
              seconds: input.seconds,
              aspectRatio: input.aspectRatio,
              storyboard: task.input.storyboard,
              storyboardOriginalImageCount: task.input.storyboardOriginalImageCount,
            },
            references: input.referenceAssetIds.map((id, index) => ({
              id,
              assetId: id,
              name: t.imageName(index + 1),
              src: assetContentUrl(id, true),
            })),
            clearDraft: false,
          });
        }}
      />
    </div>
  );
}
