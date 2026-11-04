import { Button, Label, NumberField, Spinner } from "@heroui/react";
import { imageUnitCredits, storyboardCountSchema, storyboardImageLimit } from "@lycoboai/contracts";
import { CreditCoin } from "../../../components/credit-coin";
import { ReferencePrompt } from "../../../components/reference-prompt";
import { hasPromptDescription } from "../../generation/references/prompt-description";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { VideoDuration } from "../video-duration";
import { VideoModeSwitch } from "../video-mode-switch";
import { videoPromptLimit } from "../video-state";
import { useStoryboardWorkspace } from "./storyboard-context";

export function StoryboardComposer() {
  const flow = useStoryboardWorkspace();
  const { draft, busy } = flow;
  const { progress } = draft;
  const locked =
    busy ||
    !!progress.planId ||
    !!progress.planAttempt ||
    flow.ownImagePending ||
    flow.pendingVideo;
  const valid =
    draft.references.length === 1 &&
    hasPromptDescription(draft.description) &&
    storyboardCountSchema.safeParse(draft.count).success;
  const ready = !!flow.scope && !!flow.canDraw && flow.planConfigured && flow.canVideo;
  const hasBatch = !!progress.batchId;
  return (
    <section className="composer-panel video-composer" aria-label="TK 分镜创作参数">
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <VideoModeSwitch />
        <ReferencePicker
          compact
          label="商品原图"
          required
          disabled={locked}
          references={draft.references}
          prompt={draft.description}
          limit={1}
          onChange={(references, description) => flow.update({ references, description })}
        />
        {locked ? (
          <section className="storyboard-description">
            <h2>场景描述</h2>
            <p>{draft.description}</p>
          </section>
        ) : (
          <ReferencePrompt
            className="prompt-field"
            label="场景描述"
            isRequired
            value={draft.description}
            onChange={(description) => flow.update({ description })}
            references={draft.references}
            placeholder="例如：晨光卧室，突出奶油色被面的菱格绗缝"
            maxLength={videoPromptLimit}
            showCount
            autoGrow
          />
        )}
        <NumberField
          className="storyboard-count"
          minValue={1}
          maxValue={storyboardImageLimit}
          step={1}
          value={draft.count}
          isDisabled={locked}
          onChange={(count) => {
            if (storyboardCountSchema.safeParse(count).success) flow.update({ count });
          }}
        >
          <Label>分镜图张数</Label>
          <NumberField.Group>
            <NumberField.DecrementButton aria-label="减少分镜图张数" />
            <NumberField.Input />
            <NumberField.IncrementButton aria-label="增加分镜图张数" />
          </NumberField.Group>
        </NumberField>
        <div className="ratio-heading storyboard-ratio">
          <h2>画面比例</h2>
          <span className="ratio-current">9:16</span>
        </div>
        <VideoDuration
          value={draft.seconds}
          onChange={(seconds) => {
            if (!locked) flow.update({ seconds });
          }}
          disabled={locked}
        />
      </div>
      <div className="generate-area">
        {hasBatch && !flow.ownImagePending ? (
          <Button variant="secondary" fullWidth onPress={flow.review}>
            查看分镜
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="primary-action generation-submit"
            isDisabled={busy || (!flow.ownImagePending && (!ready || !valid || flow.pendingImage))}
            isPending={busy}
            onPress={() => flow.start("plan")}
          >
            {busy && <Spinner size="sm" color="current" aria-label="正在准备分镜" />}
            {flow.ownImagePending
              ? "确认上次出图"
              : progress.planId
                ? "继续生成分镜图"
                : "生成分镜"}
            <span className="generate-credit-cost">
              <CreditCoin size="default" />
              {(progress.imageTarget && progress.imageTarget !== "batch" ? 1 : draft.count) *
                imageUnitCredits}
            </span>
          </Button>
        )}
        {!ready && !flow.ownImagePending && !hasBatch && (
          <p className="video-reference-hint">分镜创作需要语言分析、生图和视频服务均可用。</p>
        )}
      </div>
    </section>
  );
}
