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
    (production.needsResume ||
      production.busy ||
      (!draft.reuseReferences &&
        references.length > 0 &&
        references.length <= storyboardOriginalImageLimit));
  const locked = production.busy || production.needsResume;
  const currentReferences =
    locked && production.draft.references.length ? production.draft.references : references;
  const description =
    locked && production.draft.description ? production.draft.description : draft.prompt;
  const referenceLimit = Math.max(production.maxOriginalImages, references.length);
  const busy = submission.isPending || production.busy;
  const valid = hasPromptDescription(draft.prompt);
  const referenceBlocked =
    model.data?.referenceImagesEnabled === false &&
    (automatic || (!submission.hasPending && references.length > 0));
  const canSubmit = automatic
    ? !production.blocked &&
      (production.needsResume ||
        (production.configured && valid && references.length <= production.maxOriginalImages))
    : !submission.blockedByPending && (valid || submission.hasPending);
  useErrorToast(submission.error?.message ?? model.error?.message);
  return (
    <section className="composer-panel video-composer" aria-label="视频创作参数">
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <ReferencePicker
          compact
          references={currentReferences}
          prompt={description}
          onChange={setReferences}
          limit={referenceLimit}
          disabled={locked}
          label="商品图片"
        />
        {currentReferences.length > 1 && !draft.reuseReferences && (
          <p className="video-reference-hint">第 1 张为主图，其余为补充参考。</p>
        )}
        {locked ? (
          <div className="video-description-preview">
            <h2>场景描述</h2>
            <p>{description}</p>
          </div>
        ) : (
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
        )}
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
        {(automatic || referenceBlocked) && !busy && (
          <p className="video-reference-hint">
            {referenceBlocked
              ? videoReferenceUnavailableMessage
              : production.pendingVideo
                ? "沿用原提交编号核对视频任务，已生成的分镜会保留。"
                : production.needsResume
                  ? production.draft.progress.optimization?.prompt
                    ? "从提交视频继续，沿用已生成的分镜和提示词。"
                    : "从中断的步骤继续，沿用已提交的任务。"
                  : production.unavailable
                    ? "视频制作暂不可用，请稍后重试。"
                    : `预计 ${automaticVideoCost} 积分（画面 ${automaticVideoCost - videoUnitCredits} + 视频 ${videoUnitCredits}），竖屏 9:16 · 10 秒。`}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className={`primary-action generation-submit${busy ? " generation-pending" : ""}`}
          data-submitting={busy || undefined}
          isDisabled={!model.data?.enabled || busy || referenceBlocked || !canSubmit}
          isPending={busy}
          onPress={() => {
            if (automatic) {
              production.start({ description: draft.prompt, references });
              return;
            }
            revealNewestHistory();
            submission.submit({
              input: { prompt: draft.prompt, seconds: draft.seconds, aspectRatio: draft.ratio },
              references,
            });
          }}
        >
          {busy && (
            <Spinner
              size="md"
              color="current"
              role="status"
              aria-label={automatic ? "正在制作视频" : "正在提交视频任务"}
            />
          )}
          {busy && automatic
            ? "正在制作"
            : !busy && (submission.hasPending || production.pendingVideo)
              ? "确认上次提交"
              : automatic && production.needsResume
                ? "继续生成"
                : "立即生成"}
          <span className="generate-credit-cost">
            <CreditCoin size="default" />
            {automatic
              ? production.needsResume
                ? production.remainingCost
                : automaticVideoCost
              : videoUnitCredits}
          </span>
        </Button>
      </div>
    </section>
  );
}
