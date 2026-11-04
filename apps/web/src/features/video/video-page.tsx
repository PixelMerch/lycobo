import { Button, Spinner } from "@heroui/react";
import {
  storyboardOriginalImageLimit,
  videoReferenceUnavailableMessage,
  videoUnitCredits,
} from "@lycoboai/contracts";
import { CreditCoin } from "../../components/credit-coin";
import { ReferencePrompt } from "../../components/reference-prompt";
import { useErrorToast } from "../../lib/error-toast";
import { HomeRatioPicker } from "../generation/composer/ratio-picker";
import { revealNewestHistory } from "../generation/history/history-navigation";
import { hasPromptDescription } from "../generation/references/prompt-description";
import { ReferencePicker } from "../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { useStoryboardWorkspace } from "./storyboard/storyboard-context";
import { automaticVideoCost } from "./storyboard/use-storyboard";
import { useSubmitVideo, useVideoModel } from "./video-client";
import { VideoDuration } from "./video-duration";
import { useVideoDraft, videoPromptLimit, videoRatios } from "./video-state";
import "./video.css";
export function VideoPage() {
  const draft = useVideoDraft();
  const model = useVideoModel();
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
  const busy = submission.isPending || production.busy;
  const valid = hasPromptDescription(draft.prompt);
  const productionInProgress = production.busy || production.needsResume;
  // The button reflects the form's own submission; a run it has handed off only blocks the next.
  const submitting = production.busy ? !production.handedOff : submission.isPending;
  const previousVideo = submitting
    ? undefined
    : production.busy
      ? "上一条视频制作中"
      : production.needsResume
        ? "请先处理上一条视频"
        : undefined;
  const referenceBlocked =
    model.data?.referenceImagesEnabled === false && !submission.hasPending && references.length > 0;
  const canSubmit = automatic
    ? !production.blocked &&
      production.configured &&
      valid &&
      references.length <= production.maxOriginalImages
    : !submission.blockedByPending && (valid || submission.hasPending);
  const storyboardUnavailable = automatic && production.unavailable;
  useErrorToast(
    submission.error?.message ??
      model.error?.message ??
      (!productionInProgress && referenceBlocked
        ? videoReferenceUnavailableMessage
        : !productionInProgress && storyboardUnavailable
          ? "视频制作暂不可用，请稍后重试。"
          : undefined),
  );
  return (
    <section className="composer-panel video-composer" aria-label="视频创作参数">
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <ReferencePicker
          compact
          references={references}
          prompt={draft.prompt}
          onChange={setReferences}
          limit={referenceLimit}
          label="商品图片"
        />
        {references.length > 1 && !draft.reuseReferences && (
          <p className="video-reference-hint">第 1 张为主图，其余为补充参考。</p>
        )}
        <ReferencePrompt
          className="prompt-field"
          label="场景描述"
          isRequired
          value={draft.prompt}
          onChange={(prompt) => draft.update({ prompt })}
          references={references}
          onReferencesInsert={(images, prompt) => {
            if (references.length + images.length <= referenceLimit)
              setReferences([...references, ...images], prompt);
          }}
          placeholder="例如：晨光卧室，镜头推近，展示被面的绗缝和纹理"
          maxReferences={referenceLimit}
          maxLength={videoPromptLimit}
          showCount
          autoGrow
        />
        {!automatic && (
          <>
            <section className="parameter-group video-ratio">
              <div className="ratio-heading">
                <h2>画面比例</h2>
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
      <div className="generate-area">
        {automatic &&
          !productionInProgress &&
          !busy &&
          !referenceBlocked &&
          !storyboardUnavailable && (
            <p className="video-reference-hint">
              预计 {automaticVideoCost} 积分（画面 {automaticVideoCost - videoUnitCredits} + 视频{" "}
              {videoUnitCredits}），竖屏 9:16 · 10 秒。
            </p>
          )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className={`primary-action generation-submit${submitting ? " generation-pending" : ""}`}
          data-submitting={submitting || undefined}
          isDisabled={
            !model.data?.enabled || productionInProgress || busy || referenceBlocked || !canSubmit
          }
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
              aria-label={production.busy ? "正在制作视频" : "正在提交视频任务"}
            />
          )}
          {previousVideo ??
            (production.busy
              ? "正在制作"
              : !busy && submission.hasPending
                ? "确认上次提交"
                : "立即生成")}
          {!previousVideo && (
            <span className="generate-credit-cost">
              <CreditCoin size="default" />
              {automatic ? automaticVideoCost : videoUnitCredits}
            </span>
          )}
        </Button>
      </div>
    </section>
  );
}
