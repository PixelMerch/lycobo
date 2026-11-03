import { Button, ListBox, Select, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { ImageTool } from "@lycoboai/contracts";
import { IconLayoutGrid, IconRefresh, IconSparkles } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { workspaceTools } from "../workspace/workspace-state";
import { toolIcons } from "../workspace/workspace-tool-symbol";
import {
  type AssetLibraryFilters,
  type AssetMediaType,
  filtersApply,
  sameFilters,
} from "./asset-library-client";

export const toolNames = Object.fromEntries(
  workspaceTools.map((tool) => [tool.id, tool.name]),
) as Record<ImageTool, string>;
const mediaTypes: { id: AssetMediaType; label: string; compact: string }[] = [
  { id: "all", label: "全部", compact: "全部类型" },
  { id: "image", label: "图片", compact: "图片" },
  { id: "video", label: "视频", compact: "视频" },
];

/** 功能 / 类型 / 模型 for the selected source; changing any of them restarts paging. */
export function AssetFilters({
  filters,
  defaults,
  currentTool,
  models,
  loaded,
  compact,
  onChange,
}: {
  filters: AssetLibraryFilters;
  defaults: AssetLibraryFilters;
  currentTool?: ImageTool | undefined;
  models: readonly { id: string; name: string }[];
  loaded: number | null;
  compact: boolean;
  onChange: (filters: AssetLibraryFilters) => void;
}) {
  const disabled = !filtersApply(filters);
  const set = (patch: Partial<AssetLibraryFilters>) => onChange({ ...filters, ...patch });
  const ToolIcon = filters.tool === "all" ? IconLayoutGrid : toolIcons[filters.tool];
  const reset = { ...defaults, source: filters.source };
  return (
    <div className="asset-filters">
      <Select
        className="asset-filter"
        aria-label="功能"
        value={filters.tool}
        isDisabled={disabled}
        onChange={(key) => {
          const tool = workspaceTools.find((entry) => entry.id === key)?.id;
          set({ tool: tool ?? "all" });
        }}
      >
        <Select.Trigger
          className="asset-filter-trigger"
          data-active={(!disabled && filters.tool !== "all") || undefined}
        >
          <UiIcon icon={ToolIcon} className="asset-filter-lead" />
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
          <ListBox aria-label="功能">
            <ListBox.Item className="model-options" id="all" textValue="全部功能">
              <UiIcon icon={IconLayoutGrid} />
              <span>全部功能</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {workspaceTools.map((tool) => (
              <ListBox.Item
                className="model-options"
                key={tool.id}
                id={tool.id}
                textValue={tool.name}
              >
                <UiIcon icon={toolIcons[tool.id]} />
                <span>{tool.name}</span>
                {tool.id === currentTool && <span className="asset-filter-now">当前功能</span>}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {compact ? (
        <Select
          className="asset-filter"
          aria-label="类型"
          value={filters.type}
          onChange={(key) => {
            const type = mediaTypes.find((entry) => entry.id === key)?.id;
            if (type) set({ type });
          }}
        >
          <Select.Trigger
            className="asset-filter-trigger"
            data-active={filters.type !== "all" || undefined}
          >
            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
            <ListBox aria-label="类型">
              {mediaTypes.map((type) => (
                <ListBox.Item
                  className="model-options"
                  key={type.id}
                  id={type.id}
                  textValue={type.compact}
                >
                  <span>{type.compact}</span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : (
        <ToggleButtonGroup
          aria-label="类型"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filters.type]}
          onSelectionChange={(keys) => {
            const type = mediaTypes.find((entry) => keys.has(entry.id))?.id;
            if (type) set({ type });
          }}
          className="asset-segment"
        >
          {mediaTypes.map((type) => (
            <ToggleButton key={type.id} id={type.id}>
              {type.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      <Select
        className="asset-filter"
        aria-label="模型"
        value={filters.model}
        isDisabled={disabled}
        onChange={(key) => set({ model: key === null ? "all" : String(key) })}
      >
        <Select.Trigger
          className="asset-filter-trigger"
          data-active={(!disabled && filters.model !== "all") || undefined}
        >
          <UiIcon icon={IconSparkles} className="asset-filter-lead" />
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
          <ListBox aria-label="模型">
            <ListBox.Item className="model-options" id="all" textValue="全部模型">
              <span>全部模型</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {models.map((model) => (
              <ListBox.Item
                className="model-options"
                key={model.id}
                id={model.id}
                textValue={model.name}
              >
                <span>{model.name}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {!sameFilters(filters, reset) && (
        <Button
          size="sm"
          variant="ghost"
          className="asset-filter-reset"
          onPress={() => onChange(reset)}
        >
          <UiIcon icon={IconRefresh} size="small" />
          重置筛选
        </Button>
      )}
      {disabled && !compact && <span className="asset-filter-hint">上传素材不区分功能和模型</span>}
      {loaded !== null && !compact && (
        <span className="asset-filter-meta">
          已加载 <b>{loaded}</b> 项
        </span>
      )}
    </div>
  );
}
