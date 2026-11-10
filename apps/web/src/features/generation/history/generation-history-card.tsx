import { Button } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { type CSSProperties, Fragment } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { GenerationLoading, useStatusLabel } from "../generation-status";
import {
  historyResultRatio,
  historyResultRowStyle,
  historyResultUsesThumbnail,
} from "./history-result-layout";
import { HistoryTaskMeta } from "./history-task-meta";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { ResultImage } from "./result-image";
import "./history-result-layout.css";
import type { Locale } from "../../../i18n/locale";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { textileViewMessages } from "../../commerce/textile-set/textile-view-messages";
import { displayPrompt } from "../prompt-display";
import { historyMessages } from "./history-messages";

type HistoryText = (typeof historyMessages)[Locale];

/** Batches of five or more report their progress; larger batches initially show twelve images. */
const batchSize = 5;
const batchFold = 12;
function BatchProgress({ items }: { items: ImageJob["items"] }) {
  const t = useMessages(historyMessages);
  const tally = (...statuses: ImageJob["items"][number]["status"][]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  const done = tally("succeeded");
  if (done === items.length) return null;
  const running = tally("queued", "running");
  const failed = tally("failed");
  const unresolved = tally("needs_reconciliation");
  const parts = [
    t.progressDone(done, items.length),
    running ? t.progressRunning(running) : "",
    failed ? t.progressFailed(failed) : "",
    unresolved ? t.progressUnresolved(unresolved) : "",
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

function failureMessage(item: Item, t: HistoryText) {
  if (item.status === "failed") return t.failedRefunded;
  if (item.error_code === "PROVIDER_TIMEOUT") return t.timedOut;
  return t.confirming;
}

function HistoryPlaceholder({ job, item }: { job: ImageJob; item: Item }) {
  const t = useMessages(historyMessages);
  const statusLabel = useStatusLabel();
  return (
    <div
      className={placeholderClass(item.status)}
      role="status"
      aria-label={statusLabel(item.status)}
    >
      {item.status === "running" || item.status === "queued" ? (
        <GenerationLoading />
      ) : (
        <p className="generation-failure-message">{failureMessage(item, t)}</p>
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
  const locale = useLocale();
  const textileView = job.input?.textileSet?.views[item.position];
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
      {textileView && (
        <p className="textile-result-view">{textileViewMessages[locale][textileView]}</p>
      )}
      {item.output_asset_id ? (
        <ResultImage
          assetId={item.output_asset_id}
          thumbnail={historyResultUsesThumbnail(job)}
          position={item.position}
          width={item.width}
          height={item.height}
          prompt={displayPrompt(job.prompt, locale)}
          onPreview={(trigger) => onPreview(trigger, item.output_asset_id ?? "")}
        />
      ) : (
        <HistoryPlaceholder job={job} item={item} />
      )}
    </div>
  );
}

/** 一条生成历史：任务信息、提示词、操作与结果图片。 */
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
  const t = useMessages(historyMessages);
  const locale = useLocale();
  return (
    <article
      className="generation-job"
      id={compact ? undefined : `job-${job.id}`}
      data-history-id={compact ? undefined : job.id}
      data-active={!compact && active ? "true" : undefined}
    >
      {/* 任务信息、提示词与操作是一组：宽屏时整组排在结果图左侧，窄屏时排在结果图上方。 */}
      <div className="history-task-info">
        <header>
          <HistoryTaskMeta job={job} modelName={modelName} />
          {!compact && job.items.length >= batchSize && <BatchProgress items={job.items} />}
          {!compact && <HistoryTaskActions job={job} onRestore={onRestore} />}
        </header>
        {compact ? (
          <p className="generation-prompt">{displayPrompt(job.prompt, locale)}</p>
        ) : (
          <HistoryPrompt job={job} />
        )}
      </div>
      {!compact && (
        <div
          id={`results-${job.id}`}
          className="generation-results proportional-results"
          style={historyResultRowStyle(job)}
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
          {folded ? t.expandAll(job.items.length) : t.collapse}
        </Button>
      )}
    </article>
  );
}
