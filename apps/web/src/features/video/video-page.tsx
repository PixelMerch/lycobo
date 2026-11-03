import { Button } from "@heroui/react";
import { IconClock } from "@tabler/icons-react";
import { useRef } from "react";
import { ReferencePrompt } from "../../components/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { TextileImageField } from "../commerce/textile-set/textile-image-field";
import { ParameterGroup } from "../generation/composer/parameter-group";
import { WorkspaceComposerTitle } from "../workspace/workspace-tool-symbol";
import {
  useVideoDraft,
  videoDurations,
  videoPromptLimit,
  videoRatios,
  videoResolutions,
} from "./video-state";
import "./video.css";

/**
 * 视频创作 composer. The page is complete, but video generation is not connected yet: the
 * submit stays disabled and nothing is uploaded, submitted or charged.
 */
export function VideoPage() {
  const { firstFrame, lastFrame, prompt, ratio, duration, resolution, update } = useVideoDraft();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  // @ in the description can point at the frames that are already on the page.
  const frames = [
    ...(firstFrame ? [{ ...firstFrame, name: "首帧图" }] : []),
    ...(lastFrame ? [{ ...lastFrame, name: "尾帧图" }] : []),
  ];
  return (
    <section className="composer-panel video-composer" aria-label="视频创作参数">
      <div className="composer-scroll">
        <WorkspaceComposerTitle />
        <TextileImageField
          label="首帧图"
          required
          description="上传商品图作为视频的开场画面"
          exampleSrc="/studio/models/image-2-5-2.webp"
          value={firstFrame ? [firstFrame] : []}
          onChange={(images) => update({ firstFrame: images[0] ?? null })}
          number={1}
        />
        <TextileImageField
          label="尾帧图"
          description="可选，指定视频结束时的画面"
          exampleSrc="/studio/bedroom-thumb.webp"
          value={lastFrame ? [lastFrame] : []}
          onChange={(images) => update({ lastFrame: images[0] ?? null })}
          number={2}
        />
        <ReferencePrompt
          className="prompt-field"
          label="视频描述"
          inputRef={promptRef}
          value={prompt}
          onChange={(next) => update({ prompt: next })}
          references={frames}
          placeholder="描述画面主体、动作和镜头运动，例如：镜头缓慢推近，床品在晨光中展开"
          maxLength={videoPromptLimit}
          showCount
          autoGrow
        />
        <ParameterGroup
          label="视频比例"
          values={videoRatios}
          value={ratio}
          selectionId="video-ratio"
          onChange={(next) => {
            const value = videoRatios.find((entry) => entry === next);
            if (value) update({ ratio: value });
          }}
        />
        <ParameterGroup
          label="视频时长"
          values={videoDurations}
          value={duration}
          selectionId="video-duration"
          onChange={(next) => {
            const value = videoDurations.find((entry) => entry === next);
            if (value) update({ duration: value });
          }}
        />
        <ParameterGroup
          label="清晰度"
          values={videoResolutions}
          value={resolution}
          selectionId="video-resolution"
          onChange={(next) => {
            const value = videoResolutions.find((entry) => entry === next);
            if (value) update({ resolution: value });
          }}
        />
      </div>
      <div className="generate-area">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          isDisabled
          className="primary-action generation-submit"
          aria-describedby="video-service-status"
        >
          <UiIcon icon={IconClock} />
          视频生成即将开放
        </Button>
        <p id="video-service-status" className="video-service-status">
          可先准备首帧图和视频描述，开放后即可直接生成。
        </p>
      </div>
    </section>
  );
}
