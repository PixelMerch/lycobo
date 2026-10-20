import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import {
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconPhoto,
  IconSparkles,
} from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { ReferencePrompt } from "../../components/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useImageModels } from "./generation-client";
import { ReferencePicker } from "./reference-picker";
import { models, useStudioStore } from "./studio-state";

export function HomeComposer() {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model]);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const setModel = useStudioStore((s) => s.setActiveModel);
  const catalog = useImageModels();
  const navigate = useNavigate();
  const resolutions =
    catalog.data?.models.find((item) => item.id === model)?.enabledResolutions ?? [];
  return (
    <>
      <div className="home-intro">
        <span>和 Lycobo</span>
        <span>聊聊创作想法</span>
      </div>
      <div className="home-composer">
        <div className="home-upload">
          <ReferencePicker compact model={model} references={draft.references} />
        </div>
        <ReferencePrompt
          className="home-prompt"
          value={draft.prompt}
          onChange={(prompt) => updateDraft(model, { prompt })}
          references={draft.references}
          placeholder="描述你想要的画面，输入 @ 引用已上传图片"
        />
        <div className="home-composer-tools">
          <span className="home-mode-label">
            <UiIcon icon={IconPhoto} />
            图片生成
          </span>
          <Popover>
            <Button className="home-settings-trigger" variant="ghost" aria-label="选择创作模型">
              <UiIcon icon={IconSparkles} />
              <span>{model}</span>
              <span>·</span>
              <span>{draft.ratio}</span>
              <span>·</span>
              <span>{draft.resolution}</span>
              <UiIcon icon={IconChevronDown} size="small" />
            </Button>
            <Popover.Content className="home-settings" placement="bottom" offset={8}>
              <Popover.Dialog aria-label="模型和画面设置">
                <div className="home-settings-models">
                  <Popover.Heading>模型</Popover.Heading>
                  {models.map((item) => (
                    <ToggleButton
                      key={item.id}
                      variant="ghost"
                      className="home-model-option"
                      isSelected={item.id === model}
                      onPress={() => {
                        if (item.id === model) return;
                        const supported = catalog.data?.models.find(
                          (entry) => entry.id === item.id,
                        )?.enabledResolutions;
                        updateDraft(item.id, {
                          ...draft,
                          resolution: supported?.some((value) => value === draft.resolution)
                            ? draft.resolution
                            : "1K",
                        });
                        setModel(item.id);
                      }}
                    >
                      <span className="home-model-check">
                        {item.id === model && <UiIcon icon={IconCheck} />}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </span>
                    </ToggleButton>
                  ))}
                </div>
                <div className="home-settings-options">
                  <h3>画面比例</h3>
                  <ToggleButtonGroup
                    aria-label="画面比例"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[draft.ratio]}
                    onSelectionChange={(keys) =>
                      updateDraft(model, { ratio: String([...keys][0]) })
                    }
                  >
                    {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
                      <ToggleButton key={ratio} id={ratio}>
                        <span
                          className="home-ratio-shape"
                          style={{ aspectRatio: ratio.replace(":", "/") }}
                        />
                        {ratio}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <h3>图片分辨率</h3>
                  <ToggleButtonGroup
                    aria-label="图片分辨率"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[draft.resolution]}
                    onSelectionChange={(keys) =>
                      updateDraft(model, { resolution: String([...keys][0]) })
                    }
                  >
                    {["1K", "2K", "4K"].map((resolution) => (
                      <ToggleButton
                        id={resolution}
                        key={resolution}
                        isDisabled={!resolutions.some((value) => value === resolution)}
                      >
                        {resolution}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  {!resolutions.length && (
                    <p className="home-settings-note">模型可用规格将在服务连接后显示。</p>
                  )}
                  <h3>生成张数</h3>
                  <ToggleButtonGroup
                    aria-label="生成张数"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[draft.count]}
                    onSelectionChange={(keys) =>
                      updateDraft(model, { count: String([...keys][0]) })
                    }
                  >
                    {["1", "2", "3", "4"].map((count) => (
                      <ToggleButton id={count} key={count}>
                        {count} 张
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
          <Button
            isIconOnly
            className="home-submit"
            aria-label="开始创作"
            onPress={() => navigate("/create")}
          >
            <UiIcon icon={IconArrowUp} size="action" />
          </Button>
        </div>
      </div>
    </>
  );
}
