import { Button, Tooltip } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconAspectRatio } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { copyToClipboard } from "../../../lib/clipboard";

async function copyTaskId(id: string | undefined) {
  if (!id) return;
  await copyToClipboard(id);
}
export function HistoryTaskMeta({ job, modelName }: { job: ImageJob; modelName: string }) {
  return (
    <dl className="generation-meta" aria-label="任务信息">
      <div>
        <dt className="sr-only">模型</dt>
        <dd>
          <span className="model-tag">
            {job.input?.variation ? "套图计划" : job.input?.textileSet ? "家纺裂变" : modelName}
          </span>
        </dd>
      </div>
      <div>
        <dt className="sr-only">时间</dt>
        <dd>
          <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString("zh-CN")}</time>
        </dd>
      </div>
      <div className="generation-task-id-field">
        <dt>任务ID：</dt>
        <dd>
          <Tooltip delay={0} isDisabled={!job.public_id}>
            <Button
              variant="ghost"
              size="sm"
              className="generation-task-id"
              isDisabled={!job.public_id}
              aria-label={job.public_id ? `复制任务 ID ${job.public_id}` : "任务 ID 待同步"}
              onPress={(event) => {
                if (event.pointerType !== "mouse") void copyTaskId(job.public_id);
              }}
              onDoubleClick={() => void copyTaskId(job.public_id)}
            >
              {job.public_id ?? "待同步"}
            </Button>
            <Tooltip.Content placement="top">双击复制任务 ID</Tooltip.Content>
          </Tooltip>
        </dd>
      </div>
      <div className="generation-meta-ratio">
        <dt className="sr-only">比例</dt>
        <UiIcon icon={IconAspectRatio} size="small" />
        <dd>{job.aspect_ratio}</dd>
      </div>
      <div className="generation-meta-units">
        <dt className="sr-only">分辨率与张数</dt>
        <dd>{job.resolution}</dd>
        <span className="generation-meta-divider" aria-hidden="true" />
        <dd>{job.requested_count} 张</dd>
      </div>
    </dl>
  );
}
