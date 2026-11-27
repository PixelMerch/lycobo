import { Button, Tooltip } from "@heroui/react";
import { type ImageJob, imageJobTool } from "@lycoboai/contracts";
import { IconAspectRatio } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { historyMessages } from "./history-messages";

async function copyTaskId(id: string | undefined) {
  if (!id) return;
  await copyToClipboard(id);
}
/** 历史任务的信息行：工具或模型、时间、可复制的任务 ID、比例、分辨率与张数。 */
export function HistoryTaskMeta({ job, modelName }: { job: ImageJob; modelName: string }) {
  const t = useMessages(historyMessages);
  const locale = useLocale();
  const imageModelName = job.input?.textileSet ? t.textileSet : modelName;
  const taskModelName = imageJobTool(job) === "variation" ? t.variationPlan : imageModelName;
  return (
    <dl className="generation-meta" aria-label={t.taskInfo}>
      <div>
        <dt className="sr-only">{t.model}</dt>
        <dd>
          <span className="model-tag">{taskModelName}</span>
        </dd>
      </div>
      <div>
        <dt className="sr-only">{t.time}</dt>
        <dd>
          <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString(locale)}</time>
        </dd>
      </div>
      <div className="generation-task-id-field">
        <dt>{t.taskId}</dt>
        <dd>
          <Tooltip delay={0} isDisabled={!job.public_id}>
            <Button
              variant="ghost"
              size="sm"
              className="generation-task-id"
              isDisabled={!job.public_id}
              aria-label={job.public_id ? t.copyTaskId(job.public_id) : t.taskIdPending}
              onPress={(event) => {
                if (event.pointerType !== "mouse") void copyTaskId(job.public_id);
              }}
              onDoubleClick={() => void copyTaskId(job.public_id)}
            >
              {job.public_id ?? t.pending}
            </Button>
            <Tooltip.Content placement="top">{t.doubleClickToCopy}</Tooltip.Content>
          </Tooltip>
        </dd>
      </div>
      <div className="generation-meta-ratio">
        <dt className="sr-only">{t.ratio}</dt>
        <UiIcon icon={IconAspectRatio} size="small" />
        <dd>{job.aspect_ratio}</dd>
      </div>
      <div className="generation-meta-units">
        <dt className="sr-only">{t.resolutionAndCount}</dt>
        <dd>{job.resolution}</dd>
        <span className="generation-meta-divider" aria-hidden="true" />
        <dd>{t.imageCount(job.requested_count)}</dd>
      </div>
    </dl>
  );
}
