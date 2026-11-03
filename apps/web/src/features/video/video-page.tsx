import { Button } from "@heroui/react";
import { videoUnitCredits } from "@lycoboai/contracts";
import { CreditCoin } from "../../components/credit-coin";
import { ReferencePrompt } from "../../components/reference-prompt";
import { useErrorToast } from "../../lib/error-toast";
import { HomeRatioPicker } from "../generation/composer/ratio-picker";
import { hasPromptDescription } from "../generation/references/prompt-description";
import { ReferencePicker } from "../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import { useSubmitVideo, useVideoModel } from "./video-client";
import { VideoDuration } from "./video-duration";
import { useVideoDraft, videoPromptLimit, videoRatios } from "./video-state";
import "./video.css";
export function VideoPage() {
  const draft = useVideoDraft();
  const model = useVideoModel();
  const submission = useSubmitVideo();
  const references = [draft.firstFrame, draft.lastFrame, ...draft.extraReferences].filter(
    (value) => value !== null,
  );
  const setReferences = (images: typeof references, prompt = draft.prompt) =>
    draft.update({
      firstFrame: images[0] ?? null,
      lastFrame: images[1] ?? null,
      extraReferences: images.slice(2),
      prompt,
    });
  useErrorToast(submission.error?.message ?? model.error?.message);
  const valid =
    hasPromptDescription(draft.prompt) &&
    Number.isInteger(draft.seconds) &&
    draft.seconds >= 5 &&
    draft.seconds <= 30;
  return (
    <section className="composer-panel video-composer" aria-label="视频创作参数">
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <ReferencePicker
          compact
          references={references}
          prompt={draft.prompt}
          onChange={setReferences}
          limit={9}
          label="参考图片"
        />
        <p className="video-reference-hint">
          参考图片可选，用于画面内容参考；实际画幅以参考图为准。
        </p>
        <ReferencePrompt
          className="prompt-field"
          label="场景描述"
          isRequired
          value={draft.prompt}
          onChange={(prompt) => draft.update({ prompt })}
          references={references}
          onReferencesInsert={(images, prompt) => {
            if (references.length + images.length <= 9)
              setReferences([...references, ...images], prompt);
          }}
          placeholder="描述主体、动作、场景和镜头运动；多张参考图可按图一、图二描述对应关系"
          maxReferences={9}
          maxLength={videoPromptLimit}
          showCount
          autoGrow
        />
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
        <VideoDuration value={draft.seconds} onChange={(seconds) => draft.update({ seconds })} />
      </div>
      <div className="generate-area">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="primary-action generation-submit"
          isDisabled={
            !model.data?.enabled || submission.isPending || (!valid && !submission.hasPending)
          }
          isPending={submission.isPending}
          onPress={() =>
            submission.submit({
              input: { prompt: draft.prompt, seconds: draft.seconds, aspectRatio: draft.ratio },
              references,
            })
          }
        >
          {submission.hasPending ? "确认上次提交" : "立即生成"}
          <span className="generate-credit-cost">
            <CreditCoin size="default" />
            {videoUnitCredits}
          </span>
        </Button>
      </div>
    </section>
  );
}
