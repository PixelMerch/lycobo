import { Button, Tooltip, toast } from "@heroui/react";
import {
  type ImageJob,
  imageJobSchema,
  imageUnitCredits,
  publicImageModel,
  type TextileGeneration,
  type VariationGeneration,
} from "@lycoboai/contracts";
import { IconCopy, IconEdit, IconRefresh } from "@tabler/icons-react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CollapsibleText } from "../../../components/collapsible-text";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { useErrorToast } from "../../../lib/error-toast";
import {
  assetContentUrl,
  hasPendingSubmission,
  imageRequest,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "../generation-client";
import { modelCapabilities, supportsReferences } from "../models/model-capabilities";
import { displayPrompt } from "../prompt-display";
import { ReferenceThumbnails } from "../references/reference-thumbnails";
import { type Draft, type ModelId, qualityLevels, useStudioStore } from "../studio-state";
import { HistoryDownloadButton } from "./history-download-button";
import { historyMessages } from "./history-messages";

/** 历史任务的提示词：可展开的正文、复制按钮与任务参考图。 */
export function HistoryPrompt({ job }: { job: ImageJob }) {
  const t = useMessages(historyMessages);
  const prompt = displayPrompt(job.prompt, useLocale());
  return (
    <div className="history-prompt">
      <CollapsibleText text={prompt} id={`prompt-${job.id}`} className="generation-prompt" />
      <Button
        variant="secondary"
        className="copy-prompt"
        onPress={() => void copyToClipboard(prompt)}
      >
        <UiIcon icon={IconCopy} size="small" />
        {t.copyPrompt}
      </Button>
      <ReferenceThumbnails ids={job.input?.referenceAssetIds ?? []} label={t.taskReferences} />
    </div>
  );
}
export type HistoryRestore = (value: {
  model: ModelId;
  draft: Draft;
  textileSet?: TextileGeneration | undefined;
  variation?: VariationGeneration | undefined;
}) => void;
async function taskDraft(
  job: ImageJob,
  client: QueryClient,
): Promise<Parameters<HistoryRestore>[0]> {
  const input =
    job.input ??
    (
      await client.fetchQuery({
        queryKey: ["image-task", job.id],
        queryFn: async ({ signal }) =>
          imageJobSchema.parse(
            await (await imageRequest(`image-tasks/${job.id}`, { signal })).json(),
          ),
      })
    ).input;
  const t = currentMessages(historyMessages);
  if (!input) throw new Error(t.inputIncomplete);
  return {
    model: publicImageModel(input.model),
    textileSet: input.textileSet,
    variation: input.variation,
    draft: {
      prompt: input.prompt,
      ratio: input.aspectRatio,
      resolution: input.resolution === "1K" ? "1.5K" : input.resolution,
      quality: draftQuality(input.quality),
      count: String(input.count),
      references: input.referenceAssetIds.map((id, index) => ({
        id,
        assetId: id,
        name: t.imageName(index + 1),
        src: assetContentUrl(id, true),
      })),
    },
  };
}
/** 历史任务的操作：整组下载、重新编辑与重新生成。 */
export function HistoryTaskActions({
  job,
  onRestore,
  item,
}: {
  job: ImageJob;
  onRestore?: HistoryRestore | undefined;
  item?: ImageJob["items"][number] | undefined;
}) {
  const actionsRef = useHistoryActionsWidth(item);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const { generation, loading, blocked, configured, regenerateContent, regenerate, edit } =
    useHistoryTaskActions(job, item, onRestore);
  const t = useMessages(historyMessages);
  return (
    <div ref={actionsRef} className={item ? "generation-retry-overlay" : "history-task-actions"}>
      {!item && <HistoryDownloadButton job={job} />}
      {!item && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="history-icon-action"
            aria-label={t.edit}
            isDisabled={loading}
            onPress={edit}
          >
            <UiIcon icon={IconEdit} size="action" />
          </Button>
          <Tooltip.Content placement="bottom">{t.edit}</Tooltip.Content>
        </Tooltip>
      )}
      <Tooltip delay={0}>
        <Button
          isIconOnly={!item}
          variant="tertiary"
          className={item ? "generation-retry-button" : "history-icon-action"}
          aria-label={item ? t.regenerateItem(item.position + 1) : t.regenerate}
          isDisabled={blocked || !configured || generation.isPending || loading}
          onPress={() => setRegenerateOpen(true)}
        >
          <UiIcon icon={IconRefresh} size="action" />
          {item && <span>{t.regenerate}</span>}
        </Button>
        <Tooltip.Content placement="bottom">{t.regenerate}</Tooltip.Content>
      </Tooltip>
      <ConfirmDialog
        isOpen={regenerateOpen}
        title={t.regenerateTitle}
        content={regenerateContent}
        closeLabel={t.closeRegenerate}
        onCancel={() => setRegenerateOpen(false)}
        onConfirm={() => {
          setRegenerateOpen(false);
          void regenerate();
        }}
      />
    </div>
  );
}

type HistoryItem = ImageJob["items"][number];

// 历史任务的质量档位带回草稿；缺失或未知时用标准档。
function draftQuality(quality: string | undefined) {
  return qualityLevels.find((level) => level === quality) ?? "medium";
}

function historyModelOperation(job: ImageJob) {
  if (job.input?.textileSet) return "textile-set";
  return job.input?.localEdit ? "local-edit" : "create";
}

function historyTaskSource(job: ImageJob) {
  if (job.input?.textileSet) return "textile-set";
  return job.input?.variation ? "smart-variation" : undefined;
}

function useHistoryActionsWidth(item: HistoryItem | undefined) {
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (item) return;
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
  }, [item]);
  return actionsRef;
}

function historyRetryPlan(
  job: ImageJob,
  item: HistoryItem | undefined,
  pending: boolean,
  models: ReturnType<typeof useImageModels>["data"],
) {
  const blocked =
    (item
      ? !["failed", "needs_reconciliation"].includes(item.status)
      : ["queued", "running"].includes(job.status)) || pending;
  const targets = item
    ? [item]
    : job.items.filter((entry) => ["failed", "needs_reconciliation"].includes(entry.status));
  const upgradeTextile =
    !!job.input?.textileSet &&
    job.input.textileSet.version < 5 &&
    targets.every((entry) => entry.status === "failed");
  const capabilities = modelCapabilities(
    models,
    upgradeTextile ? "gpt-image-2.5" : job.model,
    historyModelOperation(job),
  );
  const configured =
    capabilities?.enabledResolutions.some((resolution) => resolution === job.resolution) &&
    supportsReferences(capabilities, job.input?.referenceAssetIds.length ?? 0);
  const retrying =
    !!item || ["failed", "partially_failed", "needs_reconciliation"].includes(job.status);
  const retryCount = retrying ? Math.max(1, targets.length) : job.requested_count;
  const count = item ? 1 : retryCount;
  const unitCredits = imageUnitCredits;
  const t = currentMessages(historyMessages);
  const regenerateContent = targets.some((entry) => entry.status === "needs_reconciliation")
    ? t.reconcileFirst
    : `${t.regenerateCost(count * unitCredits)}${upgradeTextile ? t.upgradeTextile : ""}`;
  return { blocked, configured, regenerateContent, upgradeTextile, retrying, targets };
}

function historyRetryPayload(
  restored: Awaited<ReturnType<typeof taskDraft>>,
  job: ImageJob,
  item: HistoryItem | undefined,
  {
    upgradeTextile,
    retrying,
    targets,
  }: Pick<ReturnType<typeof historyRetryPlan>, "upgradeTextile" | "retrying" | "targets">,
): Parameters<ReturnType<typeof useGenerateImage>["mutate"]>[0] {
  if (upgradeTextile && restored.textileSet) {
    const views = retrying
      ? restored.textileSet.views.filter((_, position) =>
          targets.some((entry) => entry.position === position),
        )
      : restored.textileSet.views;
    return {
      ...restored,
      model: "gpt-image-2.5",
      draft: { ...restored.draft, count: String(views.length) },
      textileSet: { version: 5, views },
      source: "textile-set",
    };
  }
  const source = historyTaskSource(job);
  const retry = retrying ? { retryJobId: job.id } : {};
  return {
    ...restored,
    ...(source ? { source } : {}),
    ...retry,
    ...(item ? { retryItemId: item.id } : {}),
  };
}

function useHistoryTaskActions(
  job: ImageJob,
  item: HistoryItem | undefined,
  onRestore: HistoryRestore | undefined,
) {
  const client = useQueryClient();
  const [loading, setLoading] = useState(false);
  const generation = useGenerateImage();
  const session = useImageSession();
  const t = useMessages(historyMessages);
  const error =
    generation.isError && hasPendingSubmission(session.data)
      ? t.submissionPending
      : generation.error?.message;
  useErrorToast(generation.isError ? error : null);
  const models = useImageModels();
  const pending = usePendingSubmission(session.data);
  const { blocked, configured, regenerateContent, upgradeTextile, retrying, targets } =
    historyRetryPlan(job, item, pending, models.data);
  const restore = (value: Awaited<ReturnType<typeof taskDraft>>) => {
    if (onRestore) {
      onRestore(value);
      return;
    }
    const { model, draft } = value;
    useStudioStore.getState().updateDraft(model, draft);
    useStudioStore.getState().setActiveModel(model);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(".composer-panel textarea")
        ?.focus({ preventScroll: true }),
    );
  };
  const regenerate = async () => {
    if (hasPendingSubmission(session.data)) return;
    setLoading(true);
    generation.reset();
    try {
      const restored = await taskDraft(job, client);
      generation.mutate(
        historyRetryPayload(restored, job, item, { upgradeTextile, retrying, targets }),
      );
    } catch (failure) {
      toast.danger(failure instanceof Error ? failure.message : t.taskUnreadable);
    } finally {
      setLoading(false);
    }
  };
  const edit = async () => {
    setLoading(true);
    generation.reset();
    try {
      restore(await taskDraft(job, client));
    } catch (failure) {
      toast.danger(failure instanceof Error ? failure.message : t.taskUnreadable);
    } finally {
      setLoading(false);
    }
  };
  return { generation, loading, blocked, configured, regenerateContent, regenerate, edit };
}
