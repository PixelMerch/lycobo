import { Alert, Button, Tooltip } from "@heroui/react";
import { imageUnitCredits, publicImageResolutions } from "@lycoboai/contracts";
import { IconArrowBarToUp, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ReferencePrompt } from "../../components/reference-prompt/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { WorkspaceComposerScroll } from "../workspace/workspace-composer-scroll";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { GenerateButton } from "./composer/generate-button";
import { ParameterGroup } from "./composer/parameter-group";
import { AspectRatioField } from "./composer/ratio-picker";
import {
  ImageApiError,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";
import { generationMessages } from "./generation-messages";
import { revealNewestHistory } from "./history/history-navigation";

import { modelCapabilities, supportsReferences } from "./models/model-capabilities";
import { ModelSelect } from "./models/model-select";
import { qualityLabel } from "./quality-label";
import { qualityMessages } from "./quality-messages";
import { hasPromptDescription } from "./references/prompt-description";
import { ReferencePicker } from "./references/reference-picker";
import { referencesMessages } from "./references/references-messages";
import {
  type Draft,
  defaultDraft,
  type ModelId,
  qualityLevels,
  useStudioStore,
} from "./studio-state";

const promptLimit = 5000;

/** 主图制作工作台：按当前模型读写草稿。 */
export function WorkspacePage() {
  const model = useStudioStore((s) => s.activeModel);
  return <Workspace model={model} />;
}
function Workspace({ model }: { model: ModelId }) {
  const locale = useLocale();
  const t = useMessages(generationMessages);
  const referenceText = useMessages(referencesMessages);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const visitModel = useStudioStore((s) => s.visitModel);
  const inputId = useRef<HTMLTextAreaElement>(null);
  const session = useImageSession();
  const modelQuery = useImageModels();
  const generate = useGenerateImage({ successFeedback: "button" });
  const [showMore, setShowMore] = useState(false);
  useErrorToast(modelQuery.isError ? imageErrorMessage(modelQuery.error) : null);
  const submissionError = generate.isError ? imageErrorMessage(generate.error) : null;
  useErrorToast(session.isError ? imageErrorMessage(session.error) : submissionError);
  const capabilities = modelCapabilities(modelQuery.data, model, "create");
  const enabledResolutions = capabilities?.enabledResolutions ?? [];
  const referencesSupported = supportsReferences(capabilities, draft.references.length);
  const pending = usePendingSubmission(session.data);
  const canGenerate =
    session.isSuccess &&
    modelQuery.data?.enabled &&
    !generate.isPending &&
    (pending ||
      (hasPromptDescription(draft.prompt) &&
        draft.prompt.length <= promptLimit &&
        enabledResolutions.some((value) => value === draft.resolution) &&
        referencesSupported));
  useEffect(() => {
    visitModel(model);
  }, [model, visitModel]);
  return (
    <section className="composer-panel" aria-label={t.composer}>
      <WorkspaceComposerScroll label={t.parameters}>
        <WorkspaceComposerTitle />
        <ReferencePicker
          compact
          label={referenceText.addReference}
          addLabel={referenceText.addReference}
          model={model}
          references={draft.references}
        />
        <ReferencePrompt
          className="prompt-field"
          label={t.prompt}
          isRequired
          inputRef={inputId}
          value={draft.prompt}
          onChange={(prompt) => updateDraft(model, { prompt })}
          onReferencesInsert={(images, prompt) =>
            updateDraft(model, { references: [...draft.references, ...images], prompt })
          }
          references={draft.references}
          placeholder={t.promptPlaceholder}
          optimizeTool="create"
          maxLength={promptLimit}
          showCount
          autoGrow
        />
        <AspectRatioField
          label={t.aspectRatio}
          value={draft.ratio}
          onChange={(ratio) => updateDraft(model, { ratio })}
        />
        <ParameterGroup
          label={t.resolution}
          values={publicImageResolutions}
          value={draft.resolution}
          disabledValues={publicImageResolutions.filter(
            (value) => !enabledResolutions.some((enabled) => enabled === value),
          )}
          onChange={(resolution) => updateDraft(model, { resolution })}
        />
        <ParameterGroup
          label={t.imageCount}
          values={["1", "2", "3", "4"]}
          value={draft.count}
          onChange={(count) => updateDraft(model, { count })}
        />
        {showMore && (
          <ParameterGroup
            label={qualityMessages[locale].title}
            values={qualityLevels}
            value={draft.quality}
            optionLabel={(level) => qualityLabel(locale, level)}
            onChange={(value) => updateDraft(model, { quality: value })}
          />
        )}
        <Button
          className="parameter-more"
          variant="ghost"
          size="sm"
          aria-expanded={showMore}
          onPress={() => setShowMore((open) => !open)}
        >
          {showMore ? t.less : t.more}
          <UiIcon icon={showMore ? IconChevronUp : IconChevronDown} size="small" />
        </Button>
      </WorkspaceComposerScroll>
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

function imageErrorMessage(error: unknown) {
  if (error instanceof ImageApiError) return error.message;
  return currentMessages(generationMessages).serviceUnavailable;
}

function useWorkspaceSubmission(
  model: ModelId,
  draft: Draft,
  generate: ReturnType<typeof useGenerateImage>,
  pending: boolean,
) {
  const updateDraft = useStudioStore((state) => state.updateDraft);
  return async () => {
    revealNewestHistory();
    await generate.mutateAsync(
      { model, draft },
      {
        onSuccess: () => {
          if (!pending && useStudioStore.getState().drafts[model] === draft)
            updateDraft(model, { prompt: "", references: [] });
        },
      },
    );
    return true;
  };
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
  const submit = useWorkspaceSubmission(model, draft, generate, pending);
  const activeSubmission = generate.isPending;
  const updateDraft = useStudioStore((state) => state.updateDraft);
  const setActiveModel = useStudioStore((state) => state.setActiveModel);
  const capabilities = modelCapabilities(modelQuery.data, model, "create");
  const referencesSupported = supportsReferences(capabilities, draft.references.length);
  const t = useMessages(generationMessages);
  const actionLabel = pending && !activeSubmission ? t.confirmLastSubmission : t.generateMainImage;
  const isDisabled = !canGenerate || activeSubmission;
  const cost = imageUnitCredits * Number(draft.count);
  const showCost = !isDisabled && !pending && cost > 0;
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
            <Alert.Description>{t.generationDisabled}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {draft.references.length > 0 && capabilities && !referencesSupported && (
        <Alert className="generation-message" role="status" status="warning">
          <Alert.Content>
            <Alert.Description>
              {capabilities?.editsEnabled
                ? t.tooManyReferences(capabilities.maxReferences)
                : t.noReferenceEditing}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <GenerateButton
        label={actionLabel}
        submitting={activeSubmission}
        isDisabled={isDisabled}
        submittingLabel={t.submitting}
        cost={showCost ? cost : undefined}
        costDescription={showCost ? t.runCost(cost) : undefined}
        onPress={submit}
      />
    </div>
  );
}
/** 回到顶部按钮：页面向下滚动一段后出现。 */
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  const t = useMessages(generationMessages);
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
        aria-label={t.backToTop}
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
      <Tooltip.Content placement="bottom">{t.backToTop}</Tooltip.Content>
    </Tooltip>
  );
}
