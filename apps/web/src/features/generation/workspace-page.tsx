import { Alert, Button, Spinner, Tooltip } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowBarToUp, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { ReferencePrompt } from "../../components/reference-prompt/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { ParameterGroup } from "./composer/parameter-group";
import { HomeRatioPicker } from "./composer/ratio-picker";
import {
  ImageApiError,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";
import { revealNewestHistory } from "./history/history-navigation";

import { modelCapabilities, supportsReferences } from "./models/model-capabilities";
import { ModelSelect } from "./models/model-select";
import { hasPromptDescription } from "./references/prompt-description";
import { ReferencePicker } from "./references/reference-picker";
import { type Draft, defaultDraft, type ModelId, useStudioStore } from "./studio-state";

const promptLimit = 5000;
const resolutionField = { label: "分辨率", values: ["1.5K", "2K", "4K"] } as const;
const advancedFields = [{ key: "quality", label: "质量", values: ["低", "标准", "高"] }] as const;

export function WorkspacePage() {
  const model = useStudioStore((s) => s.activeModel);
  return <Workspace model={model} />;
}
function Workspace({ model }: { model: ModelId }) {
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const visitModel = useStudioStore((s) => s.visitModel);
  const inputId = useRef<HTMLTextAreaElement>(null);
  const session = useImageSession();
  const modelQuery = useImageModels();
  const generate = useGenerateImage();
  const [showMore, setShowMore] = useState(false);
  useErrorToast(modelQuery.isError ? imageErrorMessage(modelQuery.error) : null);
  const submissionError = generate.isError ? imageErrorMessage(generate.error) : null;
  useErrorToast(session.isError ? (session.error?.message ?? unavailable) : submissionError);
  const capabilities = modelCapabilities(modelQuery.data, model, "create");
  const resolutions = capabilities?.enabledResolutions ?? [];
  const referencesSupported = supportsReferences(capabilities, draft.references.length);
  const pending = usePendingSubmission(session.data);
  const canGenerate =
    session.isSuccess &&
    modelQuery.data?.enabled &&
    !generate.isPending &&
    (pending ||
      (hasPromptDescription(draft.prompt) &&
        draft.prompt.length <= promptLimit &&
        resolutions.some((value) => value === draft.resolution) &&
        referencesSupported));
  useEffect(() => {
    visitModel(model);
  }, [model, visitModel]);
  return (
    <section className="composer-panel" aria-label="创作设置">
      <section className="composer-scroll" aria-label="创作参数">
        <WorkspaceComposerTitle />
        <ReferencePicker compact model={model} references={draft.references} />
        <ReferencePrompt
          className="prompt-field"
          label="提示词"
          isRequired
          inputRef={inputId}
          value={draft.prompt}
          onChange={(prompt) => updateDraft(model, { prompt })}
          onReferencesInsert={(images, prompt) =>
            updateDraft(model, { references: [...draft.references, ...images], prompt })
          }
          references={draft.references}
          placeholder="描述商品、场景或需要调整的细节，输入 @ 引用商品图"
          optimizeTool="create"
          maxLength={promptLimit}
          showCount
          autoGrow
        />
        <section className="parameter-group ratio-group" aria-label="图片比例">
          <div className="ratio-heading">
            <h2>图片比例</h2>
            <span className="ratio-current">{draft.ratio}</span>
          </div>
          <HomeRatioPicker
            value={draft.ratio}
            onChange={(ratio) => updateDraft(model, { ratio })}
          />
        </section>
        <ParameterGroup
          label={resolutionField.label}
          values={resolutionField.values}
          value={draft.resolution}
          selectionId="resolution"
          disabledValues={resolutionField.values.filter(
            (value) => !resolutions.some((enabled) => enabled === value),
          )}
          onChange={(resolution) => updateDraft(model, { resolution })}
        />
        <ParameterGroup
          label="生成张数"
          values={["1", "2", "3", "4"]}
          value={draft.count}
          selectionId="count"
          onChange={(count) => updateDraft(model, { count })}
        />
        {showMore &&
          advancedFields.map((field) => (
            <ParameterGroup
              key={field.key}
              label={field.label}
              values={field.values}
              value={draft[field.key]}
              selectionId={field.key}
              onChange={(value) =>
                updateDraft(model, field.key === "quality" ? { quality: value } : { count: value })
              }
            />
          ))}
        <Button
          className="parameter-more"
          variant="ghost"
          size="sm"
          aria-expanded={showMore}
          onPress={() => setShowMore((open) => !open)}
        >
          {showMore ? "收起" : "更多"}
          <UiIcon icon={showMore ? IconChevronUp : IconChevronDown} size="small" />
        </Button>
      </section>
      <WorkspaceGeneration
        model={model}
        draft={draft}
        modelQuery={modelQuery}
        generate={generate}
        pending={pending}
        canGenerate={!!canGenerate}
      />
    </section>
  );
}

const unavailable = "服务暂时不可用，请稍后重试。";

function imageErrorMessage(error: unknown) {
  return error instanceof ImageApiError ? error.message : unavailable;
}

function useWorkspaceSubmission(
  model: ModelId,
  draft: Draft,
  generate: ReturnType<typeof useGenerateImage>,
  pending: boolean,
) {
  const updateDraft = useStudioStore((state) => state.updateDraft);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "submitting" | "settled">("idle");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );
  const submit = () => {
    setSubmissionPhase("submitting");
    revealNewestHistory();
    generate.mutate(
      { model, draft },
      {
        onSuccess: () => {
          const cleared = !pending && useStudioStore.getState().drafts[model] === draft;
          if (cleared) {
            updateDraft(model, { prompt: "", references: [] });
            setSubmissionPhase("settled");
            if (settleTimer.current) clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(() => {
              setSubmissionPhase("idle");
            }, 600);
          } else {
            setSubmissionPhase("idle");
          }
        },
        onError: () => setSubmissionPhase("idle"),
      },
    );
  };
  return { submit, activeSubmission: submissionPhase !== "idle" || generate.isPending };
}

function WorkspaceGeneration({
  model,
  draft,
  modelQuery,
  generate,
  pending,
  canGenerate,
}: {
  model: ModelId;
  draft: Draft;
  modelQuery: ReturnType<typeof useImageModels>;
  generate: ReturnType<typeof useGenerateImage>;
  pending: boolean;
  canGenerate: boolean;
}) {
  const { submit, activeSubmission } = useWorkspaceSubmission(model, draft, generate, pending);
  const updateDraft = useStudioStore((state) => state.updateDraft);
  const setActiveModel = useStudioStore((state) => state.setActiveModel);
  const capabilities = modelCapabilities(modelQuery.data, model, "create");
  const referencesSupported = supportsReferences(capabilities, draft.references.length);
  return (
    <div className="generate-area">
      <ModelSelect
        value={model}
        onChange={(nextModel) => {
          if (nextModel === model) return;
          const supported = modelQuery.data?.models.find(
            (entry) => entry.id === nextModel,
          )?.enabledResolutions;
          updateDraft(nextModel, {
            ...draft,
            resolution: supported?.some((value) => value === draft.resolution)
              ? draft.resolution
              : "1.5K",
          });
          setActiveModel(nextModel);
        }}
      />

      {modelQuery.data && !modelQuery.data.enabled && (
        <Alert className="generation-message" role="status" status="warning">
          <Alert.Content>
            <Alert.Description>生图服务尚未启用</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {draft.references.length > 0 && capabilities && !referencesSupported && (
        <Alert className="generation-message" role="status" status="warning">
          <Alert.Content>
            <Alert.Description>
              {capabilities?.editsEnabled
                ? `当前模型最多支持 ${capabilities.maxReferences} 张参考图，请减少后生成。`
                : "当前模型暂不支持参考图编辑，请移除参考图后生成。"}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        className={`primary-action generation-submit${activeSubmission ? " generation-pending" : ""}`}
        data-submitting={activeSubmission || undefined}
        isPending={activeSubmission}
        aria-label={pending && !activeSubmission ? "确认上次提交" : "生成商品主图"}
        aria-description={
          !pending && !activeSubmission
            ? `本次生成消耗 ${imageUnitCredits * Number(draft.count)} 币`
            : undefined
        }
        isDisabled={!canGenerate || activeSubmission}
        onPress={submit}
      >
        {activeSubmission && (
          <Spinner size="md" color="current" role="status" aria-label="正在提交生图任务" />
        )}
        {pending && !activeSubmission ? "确认上次提交" : "生成商品主图"}
        {(!pending || activeSubmission) && (
          <span className="generate-credit-cost" aria-hidden="true">
            <CreditCoin />
            <span>{imageUnitCredits * Number(draft.count)}</span>
          </span>
        )}
      </Button>
    </div>
  );
}
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 240);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (!visible) return null;
  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        variant="tertiary"
        className="back-to-top-button"
        aria-label="回到顶部"
        onPress={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          })
        }
      >
        <UiIcon icon={IconArrowBarToUp} size="illustration" />
      </Button>
      <Tooltip.Content placement="bottom">回到顶部</Tooltip.Content>
    </Tooltip>
  );
}
