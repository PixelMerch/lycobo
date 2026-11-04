import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowUp, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { ReferencePrompt } from "../../components/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseSession } from "../auth/auth-client";
import { LoginRequiredInteraction } from "../auth/login-prompt";
import { HomeRatioPicker } from "../generation/composer/ratio-picker";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import { ImageApiError, useImageModels } from "../generation/generation-client";
import { ModelLogo, useModelPresentation } from "../generation/models/model-logos";
import { hasPromptDescription } from "../generation/references/prompt-description";
import { ReferencePicker } from "../generation/references/reference-picker";
import { defaultDraft, useStudioStore } from "../generation/studio-state";

export function HomeComposer() {
  const models = useModelPresentation().data?.models ?? [];
  const model = useStudioStore((s) => s.activeModel);
  const selectedModel = models.find((item) => item.id === model);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const setModel = useStudioStore((s) => s.setActiveModel);
  const signedIn = !!useEnterpriseSession().data;
  const catalog = useImageModels(signedIn);
  const navigate = useNavigate();
  const catalogError = catalog.isError
    ? catalog.error instanceof ImageApiError
      ? catalog.error.message
      : "服务暂时不可用，请稍后重试。"
    : null;
  useErrorToast(catalogError);
  const canSubmit = hasPromptDescription(draft.prompt);
  const resolutions = catalog.data?.models.find((item) => item.id === model)?.enabledResolutions;
  return (
    <LoginRequiredInteraction className="home-composer">
      <div className="home-upload">
        <ReferencePicker compact model={model} references={draft.references} />
      </div>
      <ReferencePrompt
        className="home-prompt"
        isRequired
        value={draft.prompt}
        onChange={(prompt) => updateDraft(model, { prompt })}
        onReferencesInsert={(images, prompt) =>
          updateDraft(model, { references: [...draft.references, ...images], prompt })
        }
        references={draft.references}
        placeholder="描述你想要的画面，输入 @ 引用已上传图片"
        optimizeTool="create"
      />
      <div className="home-composer-tools">
        <Popover>
          <Button className="home-settings-trigger" variant="ghost" aria-label="选择创作模型">
            <ModelLogo src={selectedModel?.logoUrl} size="compact" />
            <span>{selectedModel?.name ?? "图片创作"}</span>
            <span>·</span>
            <span>{draft.ratio}</span>
            <span>·</span>
            <span>{draft.resolution}</span>
            <span className="home-settings-chevron">
              <UiIcon icon={IconChevronDown} size="small" />
            </span>
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
                          : "1.5K",
                      });
                      setModel(item.id);
                    }}
                  >
                    <span className="home-model-check">
                      {item.id === model ? (
                        <UiIcon icon={IconCheck} />
                      ) : (
                        <span className="home-model-dot" aria-hidden="true" />
                      )}
                    </span>
                    <span>
                      <strong className="model-selector-name">
                        <ModelLogo src={item.logoUrl} size="compact" />
                        <span>{item.name}</span>
                      </strong>
                      <small>{item.description}</small>
                    </span>
                  </ToggleButton>
                ))}
              </div>
              <div className="home-settings-options">
                <div className="home-ratio-heading">
                  <h3>画面比例</h3>
                  <span className="home-ratio-current">{draft.ratio}</span>
                </div>
                <HomeRatioPicker
                  value={draft.ratio}
                  onChange={(ratio) => updateDraft(model, { ratio })}
                />
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
                  {(["1.5K", "2K", "4K"] as const).map((resolution) => (
                    <ToggleButton
                      id={resolution}
                      key={resolution}
                      isDisabled={resolutions !== undefined && !resolutions.includes(resolution)}
                    >
                      {resolution === draft.resolution && (
                        <SelectionHighlight
                          layoutId="home-resolution-selection"
                          layoutDependency={draft.resolution}
                        />
                      )}
                      {resolution}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <h3>质量</h3>
                <ToggleButtonGroup
                  aria-label="质量"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[draft.quality]}
                  onSelectionChange={(keys) =>
                    updateDraft(model, { quality: String([...keys][0]) })
                  }
                >
                  {["低", "标准", "高"].map((quality) => (
                    <ToggleButton id={quality} key={quality}>
                      {quality === draft.quality && (
                        <SelectionHighlight
                          layoutId="home-quality-selection"
                          layoutDependency={draft.quality}
                        />
                      )}
                      {quality}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <h3>生成张数</h3>
                <ToggleButtonGroup
                  aria-label="生成张数"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[draft.count]}
                  onSelectionChange={(keys) => updateDraft(model, { count: String([...keys][0]) })}
                >
                  {["1", "2", "3", "4"].map((count) => (
                    <ToggleButton id={count} key={count}>
                      {count === draft.count && (
                        <SelectionHighlight
                          layoutId="home-count-selection"
                          layoutDependency={draft.count}
                        />
                      )}
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
          data-active={canSubmit || undefined}
          isDisabled={!canSubmit}
          aria-label="开始创作"
          onPress={() => navigate("/create")}
        >
          <UiIcon icon={IconArrowUp} size="action" />
        </Button>
      </div>
    </LoginRequiredInteraction>
  );
}
