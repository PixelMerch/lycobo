import { Alert, Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import {
  IconArrowBarToUp,
  IconChevronDown,
  IconChevronUp,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { ReferencePrompt } from "../../components/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { HomeRatioPicker } from "./composer/ratio-picker";
import { SelectionHighlight } from "./composer/selection-highlight";
import {
  ImageApiError,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";

import { modelCapabilities, supportsReferences } from "./models/model-capabilities";
import { ModelSelect } from "./models/model-select";
import { ReferencePicker } from "./references/reference-picker";
import { defaultDraft, type ModelId, useStudioStore } from "./studio-state";

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
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const visitModel = useStudioStore((s) => s.visitModel);
  const inputId = useRef<HTMLTextAreaElement>(null);
  const session = useImageSession();
  const modelQuery = useImageModels();
  const generate = useGenerateImage();
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "submitting" | "settled">("idle");
  const [showMore, setShowMore] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSubmission = submissionPhase !== "idle" || generate.isPending;
  const modelsError = modelQuery.isError
    ? modelQuery.error instanceof ImageApiError
      ? modelQuery.error.message
      : "服务暂时不可用，请稍后重试。"
    : null;
  useErrorToast(modelsError);
  useErrorToast(
    session.isError
      ? (session.error?.message ?? "服务暂时不可用，请稍后重试。")
      : generate.isError
        ? generate.error instanceof ImageApiError
          ? generate.error.message
          : "服务暂时不可用，请稍后重试。"
        : null,
  );
  const capabilities = modelCapabilities(modelQuery.data, model, "create");
  const resolutions = capabilities?.enabledResolutions ?? [];
  const referencesSupported = supportsReferences(capabilities, draft.references.length);
  const pending = usePendingSubmission(session.data);
  const canGenerate =
    session.isSuccess &&
    modelQuery.data?.enabled &&
    !generate.isPending &&
    (pending ||
      (draft.prompt.trim().length > 0 &&
        draft.prompt.length <= promptLimit &&
        resolutions.some((value) => value === draft.resolution) &&
        referencesSupported));
  useEffect(() => {
    visitModel(model);
  }, [model, visitModel]);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );
  return (
    <section className="composer-panel" aria-label="创作设置">
      <WorkspaceComposerTitle />
      <section className="composer-scroll" aria-label="创作参数">
        <ReferencePicker compact model={model} references={draft.references} />
        <ReferencePrompt
          className="prompt-field"
          label="提示词"
          inputRef={inputId}
          value={draft.prompt}
          onChange={(prompt) => updateDraft(model, { prompt })}
          references={draft.references}
          placeholder="描述商品、场景或需要调整的细节，输入 @ 引用商品图"
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
        {draft.references.length > 0 && modelQuery.data && !referencesSupported && (
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
          aria-description={
            !pending && !activeSubmission
              ? `本次生成消耗 ${imageUnitCredits * Number(draft.count)} 币`
              : undefined
          }
          isDisabled={!canGenerate || activeSubmission}
          onPress={() => {
            setSubmissionPhase("submitting");
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
          }}
        >
          {activeSubmission && (
            <span className="generate-button-icon generation-loading-icon">
              <UiIcon icon={IconSparkles} />
            </span>
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
    </section>
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
function ParameterGroup({
  label,
  values,
  value,
  onChange,
  selectionId,
  disabledValues = [],
}: {
  label: string;
  values: readonly string[];
  disabledValues?: readonly string[];
  value: string;
  selectionId: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="parameter-group">
      <legend>{label}</legend>
      <ToggleButtonGroup
        aria-label={label}
        className="parameter-options"
        disallowEmptySelection
        isDetached
        selectedKeys={[value]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next !== undefined) onChange(String(next));
        }}
      >
        {values.map((option) => (
          <ToggleButton key={option} id={option} isDisabled={disabledValues.includes(option)}>
            {option === value && (
              <SelectionHighlight
                layoutId={`workspace-${selectionId}-selection`}
                layoutDependency={value}
              />
            )}
            <span>{option}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
}
