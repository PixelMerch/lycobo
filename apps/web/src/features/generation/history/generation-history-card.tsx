import { Button } from "@heroui/react";
import { type ImageJob, textileViews } from "@lycoboai/contracts";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { type CSSProperties, Fragment } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { GenerationLoading, statusLabel } from "../generation-status";
import { historyResultRatio } from "./history-result-layout";
import { HistoryTaskMeta } from "./history-task-meta";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { ResultImage } from "./result-image";
import "./history-result-layout.css";

/** Batches of five or more report their progress; larger batches initially show twelve images. */
const batchSize = 5;
const batchFold = 12;
function BatchProgress({ items }: { items: ImageJob["items"] }) {
  const tally = (...statuses: ImageJob["items"][number]["status"][]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  const done = tally("succeeded");
  if (done === items.length) return null;
  const running = tally("queued", "running");
  const failed = tally("failed");
  const unresolved = tally("needs_reconciliation");
  const parts = [
    `已完成 ${done}/${items.length}`,
    running ? `生成中 ${running}` : "",
    failed ? `失败 ${failed}` : "",
    unresolved ? `待确认 ${unresolved}` : "",
  ].filter(Boolean);
  return (
    <p className="history-batch-progress">
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && " · "}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

type Item = ImageJob["items"][number];
type ShowPreview = (trigger: HTMLElement, assetId: string) => void;

function placeholderClass(status: Item["status"]) {
  if (status === "running" || status === "queued")
    return "generation-placeholder generation-pending";
  if (status === "failed" || status === "needs_reconciliation")
    return "generation-placeholder generation-failed";
  return "generation-placeholder";
}

function failureMessage(item: Item) {
  if (item.status === "failed") return "任务未能完成，积分已退回，请您稍后重试。";
  if (item.error_code === "PROVIDER_TIMEOUT")
    return "生成超时，请重新生成。将先查询并恢复已有结果。";
  return "生成结果和积分状态正在确认，请稍后查看。";
}

function HistoryPlaceholder({ job, item }: { job: ImageJob; item: Item }) {
  return (
    <div
      className={placeholderClass(item.status)}
      role="status"
      aria-label={statusLabel[item.status]}
    >
      {item.status === "running" || item.status === "queued" ? (
        <GenerationLoading />
      ) : (
        <p className="generation-failure-message">{failureMessage(item)}</p>
      )}
      {(item.status === "failed" || item.status === "needs_reconciliation") && (
        <HistoryTaskActions job={job} item={item} />
      )}
    </div>
  );
}

function HistoryResult({
  job,
  item,
  onPreview,
}: {
  job: ImageJob;
  item: Item;
  onPreview: ShowPreview;
}) {
  const style: CSSProperties & { "--result-ratio": number } = {
    "--result-ratio": historyResultRatio(job, item),
  };
  return (
    <div
      style={style}
      id={`result-${item.id}`}
      className={
        item.status === "failed" || item.status === "needs_reconciliation"
          ? "generation-failed-result"
          : undefined
      }
    >
      {job.input?.variation && (
        <p className="textile-result-view">{job.input.variation.items[item.position]?.title}</p>
      )}
      {job.input?.textileSet && (
        <p className="textile-result-view">
          {
            textileViews.find((view) => view.id === job.input?.textileSet?.views[item.position])
              ?.name
          }
        </p>
      )}
      {item.output_asset_id ? (
        <ResultImage
          assetId={item.output_asset_id}
          thumbnail={job.requested_count > 1}
          position={item.position}
          width={item.width}
          height={item.height}
          prompt={job.prompt}
          onPreview={(trigger) => onPreview(trigger, item.output_asset_id ?? "")}
        />
      ) : (
        <HistoryPlaceholder job={job} item={item} />
      )}
    </div>
  );
}

export function GenerationHistoryCard({
  job,
  compact,
  active,
  modelName,
  onRestore,
  folded,
  toggleFold,
  onPreview,
}: {
  job: ImageJob;
  compact: boolean;
  active: boolean;
  modelName: string;
  onRestore: import("./history-task-tools").HistoryRestore | undefined;
  folded: boolean;
  toggleFold: () => void;
  onPreview: ShowPreview;
}) {
  return (
    <article
      className="generation-job"
      id={compact ? undefined : `job-${job.id}`}
      data-history-id={compact ? undefined : job.id}
      data-active={!compact && active ? "true" : undefined}
    >
      <header>
        <HistoryTaskMeta job={job} modelName={modelName} />
        {!compact && job.items.length >= batchSize && <BatchProgress items={job.items} />}
        {!compact && <HistoryTaskActions job={job} onRestore={onRestore} />}
      </header>
      {compact ? <p className="generation-prompt">{job.prompt}</p> : <HistoryPrompt job={job} />}
      {!compact && (
        <div
          id={`results-${job.id}`}
          className="generation-results proportional-results"
          style={resultLayoutStyle(job)}
          data-count={job.items.length}
          data-failed={
            job.items.some(
              (item) => item.status === "failed" || item.status === "needs_reconciliation",
            ) || undefined
          }
        >
          {(folded ? job.items.slice(0, batchFold) : job.items).map((item) => (
            <HistoryResult key={item.id} job={job} item={item} onPreview={onPreview} />
          ))}
        </div>
      )}
      {!compact && job.items.length > batchFold && (
        <Button
          size="sm"
          variant="tertiary"
          className="history-batch-toggle"
          aria-expanded={!folded}
          aria-controls={`results-${job.id}`}
          onPress={toggleFold}
        >
          <UiIcon icon={folded ? IconChevronDown : IconChevronUp} size="small" />
          {folded ? `展开全部 ${job.items.length} 张` : "收起"}
        </Button>
      )}
    </article>
  );
}

function resultLayoutStyle(job: ImageJob) {
  const style: CSSProperties & { "--result-max-ratio": number } = {
    "--result-max-ratio": Math.max(1, ...job.items.map((item) => historyResultRatio(job, item))),
  };
  return style;
}
