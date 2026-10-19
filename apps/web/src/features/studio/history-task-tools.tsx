import { Button, Modal, Tooltip } from "@heroui/react";
import { type ImageJob, imageJobSchema } from "@lycoboai/contracts";
import { IconCheck, IconCopy, IconEdit, IconRefresh } from "@tabler/icons-react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { type Draft, type ModelId, useStudioStore } from "./studio-state";

export function HistoryPrompt({ job }: { job: ImageJob }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [copied, setCopied] = useState(false);
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
        data-copied={copied || undefined}
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(job.prompt);
            setCopied(true);
            setError("");
          } catch {
            setError("复制失败，请手动选择提示词复制。");
          }
        }}
      >
        <UiIcon icon={copied ? IconCheck : IconCopy} size="small" />
        {copied ? "已复制" : "复制提示词"}
      </Button>
      {error && <p role="alert">{error}</p>}
      <div className="generation-output-thumbnails">
        {job.items.map((item) =>
          item.output_asset_id ? (
            <Button
              variant="tertiary"
              key={item.id}
              className="generation-output-thumbnail"
              aria-label={`定位生成图片 ${item.position + 1}`}
              onPress={() =>
                document
                  .getElementById(`result-${item.id}`)
                  ?.scrollIntoView({ block: "center", behavior: "instant" })
              }
            >
              <img
                src={assetContentUrl(item.output_asset_id, true)}
                alt={`生成图片 ${item.position + 1} 缩略图`}
                loading="lazy"
              />
            </Button>
          ) : null,
        )}
      </div>
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
    model: input.model,
    draft: {
      prompt: input.prompt,
      ratio: input.aspectRatio,
      resolution: input.resolution,
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
  const [replacement, setReplacement] = useState<Awaited<ReturnType<typeof taskDraft>> | null>(
    null,
  );
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useGenerateImage();
  const session = useImageSession();
  const models = useImageModels();
  const pending = usePendingSubmission(session.data);
  const blocked = ["queued", "running", "needs_reconciliation"].includes(job.status) || pending;
  const configured =
    models.data?.enabled &&
    models.data.models.some(
      (model) =>
        model.id === job.model &&
        model.enabledResolutions.some((resolution) => resolution === job.resolution),
    ) &&
    (!job.input?.referenceAssetIds.length || models.data.editsEnabled);
  const restore = ({ model, draft }: Awaited<ReturnType<typeof taskDraft>>) => {
    useStudioStore.getState().updateDraft(model, draft);
    useStudioStore.getState().setActiveModel(model);
    setReplacement(null);
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
      generation.mutate(await taskDraft(job, client));
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
              const value = await taskDraft(job, client);
              const draft = useStudioStore.getState().drafts[value.model];
              if (draft.prompt || draft.references.length) setReplacement(value);
              else restore(value);
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
        <p className="history-action-error" role="alert">
          {error ||
            (hasPendingSubmission(session.data)
              ? "提交结果待确认，请在左侧确认上次提交。"
              : generation.error?.message)}
        </p>
      )}
      <Modal
        isOpen={regenerateOpen}
        onOpenChange={(open) => {
          if (!open) setRegenerateOpen(false);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="info-dialog">
              <Modal.Header>
                <Modal.Heading>重新生成这张图片？</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭重新生成确认" />
              </Modal.Header>
              <Modal.Body>
                <p>将使用相同的提示词、参考图和参数新建一个生成任务。</p>
                <div className="history-confirm-actions">
                  <Button variant="secondary" onPress={() => setRegenerateOpen(false)}>
                    取消
                  </Button>
                  <Button
                    className="primary-action"
                    onPress={() => {
                      setRegenerateOpen(false);
                      void regenerate();
                    }}
                  >
                    重新生成
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal
        isOpen={replacement !== null}
        onOpenChange={(open) => {
          if (!open) setReplacement(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="info-dialog">
              <Modal.Header>
                <Modal.Heading>替换当前草稿？</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭草稿确认" />
              </Modal.Header>
              <Modal.Body>
                <p>该模型已有草稿，继续编辑将替换提示词、参考图和参数。</p>
                <div className="history-confirm-actions">
                  <Button variant="secondary" onPress={() => setReplacement(null)}>
                    保留草稿
                  </Button>
                  <Button
                    className="primary-action"
                    onPress={() => {
                      if (replacement) restore(replacement);
                    }}
                  >
                    替换并编辑
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
