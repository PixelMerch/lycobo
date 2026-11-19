import { Button, Spinner } from "@heroui/react";
import { storyboardOriginalImageLimit, videoUnitCredits } from "@lycoboai/contracts";
import { IconSparkle } from "@tabler/icons-react";
import { ReferencePrompt } from "../../components/reference-prompt/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { HomeRatioPicker } from "../generation/composer/ratio-picker";
import { revealNewestHistory } from "../generation/history/history-navigation";
import { hasPromptDescription } from "../generation/references/prompt-description";
import { ReferencePicker } from "../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { VideoDuration } from "./production/video-duration";
import { useStoryboardWorkspace } from "./storyboard/storyboard-context";
import { automaticVideoCost } from "./storyboard/use-storyboard";
import { useSubmitVideo, useVideoModel } from "./video-client";
import { useVideoDraft, videoPromptLimit, videoRatios } from "./video-state";
import "./video.css";
import type { Locale } from "../../i18n/locale";
import { useMessages } from "../../i18n/messages";
import { videoMessages } from "./video-messages";
/** 视频创作的参数面板：商品图、场景描述、比例与时长，或自动分镜制作。 */
export function VideoPage() {
  const t = useMessages(videoMessages);
  const draft = useVideoDraft();
  const submission = useSubmitVideo();
  const production = useStoryboardWorkspace();
  const references = [draft.firstFrame, draft.lastFrame, ...draft.extraReferences].filter(
    (value) => value !== null,
  );
  const setReferences = (images: typeof references, prompt = draft.prompt) =>
    draft.update({
      firstFrame: images[0] ?? null,
      lastFrame: images[1] ?? null,
      extraReferences: images.slice(2),
      prompt,
      reuseReferences: false,
    });
  const automatic =
    !submission.hasPending &&
    !draft.reuseReferences &&
    references.length > 0 &&
    references.length <= storyboardOriginalImageLimit;
  const referenceLimit = Math.max(production.maxOriginalImages, references.length);
  return (
    <section className="composer-panel video-composer" aria-label={t.parameters}>
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <ReferencePicker
          compact
          references={references}
          prompt={draft.prompt}
          onChange={setReferences}
          limit={referenceLimit}
          label={t.productImages}
        />
        {references.length > 1 && !draft.reuseReferences && (
          <p className="video-reference-hint">{t.productImagesHint}</p>
        )}
        <ReferencePrompt
          className="prompt-field"
          label={t.scene}
          isRequired
          value={draft.prompt}
          onChange={(prompt) => draft.update({ prompt })}
          references={references}
          onReferencesInsert={(images, prompt) => {
            if (references.length + images.length <= referenceLimit)
              setReferences([...references, ...images], prompt);
          }}
          placeholder={t.scenePlaceholder}
          optimizeTool="video"
          maxReferences={referenceLimit}
          maxLength={videoPromptLimit}
          showCount
          autoGrow
        />
        {!automatic && (
          <>
            <section className="parameter-group video-ratio">
              <div className="ratio-heading">
                <h2>{t.aspectRatio}</h2>
                <span className="ratio-current">{draft.ratio}</span>
              </div>
              <HomeRatioPicker
                value={draft.ratio}
                ratios={videoRatios}
                onChange={(next) => {
                  const ratio = videoRatios.find((value) => value === next);
                  if (ratio) draft.update({ ratio });
                }}
              />
            </section>
            <VideoDuration
              value={draft.seconds}
              onChange={(seconds) => draft.update({ seconds })}
            />
          </>
        )}
      </div>
      <VideoGeneration
        draft={draft}
        references={references}
        automatic={automatic}
        production={production}
        submission={submission}
      />
    </section>
  );
}

type Production = ReturnType<typeof useStoryboardWorkspace>;
type VideoDraft = ReturnType<typeof useVideoDraft.getState>;

type VideoText = (typeof videoMessages)[Locale];

function previousVideoLabel(submitting: boolean, production: Production, t: VideoText) {
  if (submitting) return undefined;
  if (production.busy) return t.previousRunning;
  return production.needsResume ? t.resolvePrevious : undefined;
}

function videoAvailabilityMessage(
  referenceBlocked: boolean,
  storyboardUnavailable: boolean,
  t: VideoText,
) {
  if (referenceBlocked) return t.referencesUnavailable;
  return storyboardUnavailable ? t.unavailable : undefined;
}

function VideoGeneration({
  draft,
  references,
  automatic,
  production,
  submission,
}: {
  draft: VideoDraft;
  references: NonNullable<VideoDraft["firstFrame"]>[];
  automatic: boolean;
  production: Production;
  submission: ReturnType<typeof useSubmitVideo>;
}) {
  const { submitting, previousVideo, submitLabel, showEstimate, disabled } =
    useVideoGenerationState({
      prompt: draft.prompt,
      referenceCount: references.length,
      automatic,
      production,
      submission,
    });
  const t = useMessages(videoMessages);
  return (
    <div className="generate-area">
      {showEstimate && (
        <p className="video-reference-hint">
          {t.estimate(automaticVideoCost, automaticVideoCost - videoUnitCredits, videoUnitCredits)}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        className={`primary-action generation-submit${submitting ? " generation-pending" : ""}`}
        data-submitting={submitting || undefined}
        isDisabled={disabled}
        isPending={submitting}
        onPress={() => {
          revealNewestHistory();
          if (automatic) {
            production.start({ description: draft.prompt, references });
            return;
          }
          submission.submit({
            input: { prompt: draft.prompt, seconds: draft.seconds, aspectRatio: draft.ratio },
            references,
          });
        }}
      >
        {submitting && (
          <Spinner
            size="md"
            color="current"
            role="status"
            aria-label={production.busy ? t.producing : t.submitting}
          />
        )}
        {previousVideo ?? submitLabel}
        {!previousVideo && (
          <span className="generate-credit-cost">
            <UiIcon icon={IconSparkle} />
            {automatic ? automaticVideoCost : videoUnitCredits}
          </span>
        )}
      </Button>
    </div>
  );
}

function useVideoGenerationState({
  prompt,
  referenceCount,
  automatic,
  production,
  submission,
}: {
  prompt: string;
  referenceCount: number;
  automatic: boolean;
  production: Production;
  submission: ReturnType<typeof useSubmitVideo>;
}) {
  const model = useVideoModel();
  const t = useMessages(videoMessages);
  const busy = submission.isPending || production.busy;
  const valid = hasPromptDescription(prompt);
  const productionInProgress = production.busy || production.needsResume;
  // 按钮只反映这个表单自己的提交；已交出去的制作只会挡住下一次提交。
  const submitting = production.busy ? !production.handedOff : submission.isPending;
  const previousVideo = previousVideoLabel(submitting, production, t);
  const referenceBlocked =
    model.data?.referenceImagesEnabled === false && !submission.hasPending && referenceCount > 0;
  const canSubmit = canSubmitVideo(automatic, production, submission, valid, referenceCount);
  const storyboardUnavailable = automatic && production.unavailable;
  const unavailable = productionInProgress
    ? undefined
    : videoAvailabilityMessage(referenceBlocked, storyboardUnavailable, t);
  useErrorToast(submission.error?.message ?? model.error?.message ?? unavailable);
  const idleLabel = !busy && submission.hasPending ? t.confirmLastSubmission : t.generateNow;
  const submitLabel = production.busy ? t.inProduction : idleLabel;
  const idle = !productionInProgress && !busy && !referenceBlocked;
  return {
    submitting,
    previousVideo,
    submitLabel,
    showEstimate: automatic && idle && !storyboardUnavailable,
    disabled: !model.data?.enabled || !idle || !canSubmit,
  };
}

function canSubmitVideo(
  automatic: boolean,
  production: Production,
  submission: ReturnType<typeof useSubmitVideo>,
  valid: boolean,
  referenceCount: number,
) {
  if (!automatic) return !submission.blockedByPending && (valid || submission.hasPending);
  return (
    !production.blocked &&
    production.configured &&
    valid &&
    referenceCount <= production.maxOriginalImages
  );
}
