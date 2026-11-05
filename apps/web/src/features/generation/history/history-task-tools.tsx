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
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
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
import { ReferenceThumbnails } from "../references/reference-thumbnails";
import { type Draft, type ModelId, useStudioStore } from "../studio-state";
import { HistoryDownloadButton } from "./history-download-button";

export function HistoryPrompt({ job }: { job: ImageJob }) {
  return (
    <div className="history-prompt">
      <CollapsibleText text={job.prompt} id={`prompt-${job.id}`} className="generation-prompt" />
      <Button
        variant="secondary"
        className="copy-prompt"
        onPress={() => void copyToClipboard(job.prompt)}
      >
        <UiIcon icon={IconCopy} size="small" />
        复制提示词
      </Button>
      <ReferenceThumbnails ids={job.input?.referenceAssetIds ?? []} label="任务参考图" />
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
  if (!input) throw new Error("任务输入不完整，无法恢复，请重新创作。");
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
        name: `图片${index + 1}`,
        src: assetContentUrl(id, true),
      })),
    },
  };
}
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
  return (
    <div ref={actionsRef} className={item ? "generation-retry-overlay" : "history-task-actions"}>
      {!item && <HistoryDownloadButton job={job} />}
      {!item && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="history-icon-action"
            aria-label="重新编辑"
            isDisabled={loading}
            onPress={edit}
          >
            <UiIcon icon={IconEdit} size="action" />
          </Button>
          <Tooltip.Content placement="bottom">重新编辑</Tooltip.Content>
        </Tooltip>
      )}
      <Tooltip delay={0}>
        <Button
          isIconOnly={!item}
          variant="tertiary"
          className={item ? "generation-retry-button" : "history-icon-action"}
          aria-label={item ? `重新生成第 ${item.position + 1} 张` : "重新生成"}
          isDisabled={blocked || !configured || generation.isPending || loading}
          onPress={() => setRegenerateOpen(true)}
        >
          <UiIcon icon={IconRefresh} size="action" />
          {item && <span>重新生成</span>}
        </Button>
        <Tooltip.Content placement="bottom">重新生成</Tooltip.Content>
      </Tooltip>
      <ConfirmDialog
        isOpen={regenerateOpen}
        title="重新生成这张图片？"
        content={regenerateContent}
        closeLabel="关闭重新生成确认"
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

function draftQuality(quality: string | undefined) {
  if (quality === "low") return "低";
  return quality === "high" ? "高" : "标准";
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
  const regenerateContent = targets.some((entry) => entry.status === "needs_reconciliation")
    ? "先查询原任务，已有结果将直接保存；确认需重新生成时才扣除积分。"
    : `本次消耗 ${count * unitCredits} 积分${
        upgradeTextile ? "。使用最新裂变配置创建新任务，原记录保留。" : ""
      }`;
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
  const error =
    generation.isError && hasPendingSubmission(session.data)
      ? "提交结果待确认，请在左侧确认上次提交。"
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
      toast.danger(failure instanceof Error ? failure.message : "无法读取任务。");
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
      toast.danger(failure instanceof Error ? failure.message : "无法读取任务。");
    } finally {
      setLoading(false);
    }
  };
  return { generation, loading, blocked, configured, regenerateContent, regenerate, edit };
}
