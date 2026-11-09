import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { mainImageModelIds } from "@lycoboai/contracts";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseSession } from "../auth/auth-client";
import { HomeRatioPicker } from "../generation/composer/ratio-picker";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import { ImageApiError, useImageModels } from "../generation/generation-client";
import { ModelLogo, useModelPresentation } from "../generation/models/model-logos";
import { defaultDraft, useStudioStore } from "../generation/studio-state";

type ModelCatalog = ReturnType<typeof useImageModels>;
type PresentedModels = NonNullable<ReturnType<typeof useModelPresentation>["data"]>["models"];

/** 主图模式的模型与画面设置，所有修改直接写入当前模型草稿。 */
export function HomeModelSettings() {
  const presentation = useModelPresentation().data?.models ?? [];
  const models = mainImageModelIds.flatMap((id) => presentation.filter((model) => model.id === id));
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const signedIn = !!useEnterpriseSession().data;
  const catalog = useImageModels(signedIn);
  const requestError =
    catalog.error instanceof ImageApiError ? catalog.error.message : "服务暂时不可用，请稍后重试。";
  useErrorToast(catalog.isError ? requestError : null);
  const selectedModel = models.find((item) => item.id === model);
  return (
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
      <Popover.Content className="home-settings" placement="bottom end" offset={8}>
        <Popover.Dialog aria-label="模型和画面设置">
          <HomeModelList models={models} catalog={catalog} />
          <HomePictureOptions catalog={catalog} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function HomeModelList({ models, catalog }: { models: PresentedModels; catalog: ModelCatalog }) {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const setModel = useStudioStore((s) => s.setActiveModel);
  function choose(id: string) {
    if (id === model) return;
    const supported = catalog.data?.models.find((entry) => entry.id === id)?.enabledResolutions;
    // 新模型不支持当前分辨率时回到默认档，避免带着不可用参数进入工作台。
    updateDraft(id, {
      ...draft,
      resolution: supported?.some((value) => value === draft.resolution)
        ? draft.resolution
        : "1.5K",
    });
    setModel(id);
  }
  return (
    <div className="home-settings-models">
      <Popover.Heading>模型</Popover.Heading>
      {models.map((item) => (
        <ToggleButton
          key={item.id}
          variant="ghost"
          className="home-model-option"
          isSelected={item.id === model}
          onPress={() => choose(item.id)}
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
  );
}

function HomePictureOptions({ catalog }: { catalog: ModelCatalog }) {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const resolutions = catalog.data?.models.find((item) => item.id === model)?.enabledResolutions;
  return (
    <div className="home-settings-options">
      <div className="home-ratio-heading">
        <h3>画面比例</h3>
        <span className="home-ratio-current">{draft.ratio}</span>
      </div>
      <HomeRatioPicker value={draft.ratio} onChange={(ratio) => updateDraft(model, { ratio })} />
      <h3>图片分辨率</h3>
      <ToggleButtonGroup
        aria-label="图片分辨率"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[draft.resolution]}
        onSelectionChange={(keys) => updateDraft(model, { resolution: String([...keys][0]) })}
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
        onSelectionChange={(keys) => updateDraft(model, { quality: String([...keys][0]) })}
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
              <SelectionHighlight layoutId="home-count-selection" layoutDependency={draft.count} />
            )}
            {count} 张
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
