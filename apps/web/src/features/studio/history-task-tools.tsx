import { Alert, Button, Tooltip, toast } from "@heroui/react";
import {
  type ImageJob,
  imageJobSchema,
  imageUnitCredits,
  publicImageModel,
} from "@lycoboai/contracts";
import { IconCopy, IconEdit, IconRefresh } from "@tabler/icons-react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { UiIcon } from "../../components/ui-icon";
import {
  assetContentUrl,
  hasPendingSubmission,
  imageRequest,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";
import { ReferenceThumbnails } from "./reference-thumbnails";
import { type Draft, type ModelId, useStudioStore } from "./studio-state";

export function HistoryPrompt({ job }: { job: ImageJob }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = text.current;
    if (!node || expanded || !job.prompt) return;
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [expanded, job.prompt]);
  return (
    <div className="history-prompt">
      <p
        className={`generation-prompt${expanded ? "" : " prompt-collapsed"}`}
        ref={text}
        id={`prompt-${job.id}`}
      >
        {job.prompt}
      </p>
      {(overflow || expanded) && (
        <Button
          variant="tertiary"
          className="prompt-toggle"
          aria-expanded={expanded}
          aria-controls={`prompt-${job.id}`}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : "展开全部"}
        </Button>
      )}
      <Button
        variant="secondary"
        className="copy-prompt"
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(job.prompt);
            toast.success("复制成功");
            setError("");
          } catch {
            setError("复制失败，请手动选择提示词复制。");
          }
        }}
      >
        <UiIcon icon={IconCopy} size="small" />
        复制提示词
      </Button>
      {error && (
        <Alert className="field-error" role="alert" status="danger">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <ReferenceThumbnails ids={job.input?.referenceAssetIds ?? []} label="任务参考图" />
    </div>
  );
}
async function taskDraft(
  job: ImageJob,
  client: QueryClient,
): Promise<{ model: ModelId; draft: Draft }> {
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
    draft: {
      prompt: input.prompt,
      ratio: input.aspectRatio,
      resolution: input.resolution,
      quality: input.quality === "low" ? "低" : input.quality === "high" ? "高" : "标准",
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
export function HistoryTaskActions({ job }: { job: ImageJob }) {
  const client = useQueryClient();
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useGenerateImage();
  const session = useImageSession();
  const models = useImageModels();
  const pending = usePendingSubmission(session.data);
  const blocked = ["queued", "running"].includes(job.status) || pending;
  const configured =
    models.data?.enabled &&
    models.data.models.some(
      (model) =>
        model.id === publicImageModel(job.model) &&
        model.enabledResolutions.some((resolution) => resolution === job.resolution),
    ) &&
    (!job.input?.referenceAssetIds.length || models.data.editsEnabled);
  const restore = ({ model, draft }: Awaited<ReturnType<typeof taskDraft>>) => {
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
    setError("");
    try {
      generation.mutate({
        ...(await taskDraft(job, client)),
        ...(["failed", "partially_failed", "needs_reconciliation"].includes(job.status)
          ? { retryJobId: job.id }
          : {}),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "无法读取任务。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="history-task-actions">
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="tertiary"
          className="history-icon-action"
          aria-label="重新编辑"
          isDisabled={loading}
          onPress={async () => {
            setLoading(true);
            setError("");
            try {
              restore(await taskDraft(job, client));
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "无法读取任务。");
            } finally {
              setLoading(false);
            }
          }}
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
          isDisabled={blocked || !configured || generation.isPending || loading}
          onPress={() => setRegenerateOpen(true)}
        >
          <UiIcon icon={IconRefresh} size="action" />
        </Button>
        <Tooltip.Content placement="bottom">重新生成</Tooltip.Content>
      </Tooltip>
      {(error || generation.isError) && (
        <Alert className="history-action-error" role="alert" status="danger">
          <Alert.Content>
            <Alert.Description>
              {error ||
                (hasPendingSubmission(session.data)
                  ? "提交结果待确认，请在左侧确认上次提交。"
                  : generation.error?.message)}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <ConfirmDialog
        isOpen={regenerateOpen}
        title="重新生成这张图片？"
        content={
          ["failed", "partially_failed", "needs_reconciliation"].includes(job.status)
            ? `${imageUnitCredits} 积分`
            : `将使用相同的提示词、参考图和参数新建任务，提交时扣除 ${job.requested_count * imageUnitCredits} 币，失败按张退回。`
        }
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
