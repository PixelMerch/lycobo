import { Button, ListBox, Select, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { AssetTool } from "@lycoboai/contracts";
import {
  IconCalendar,
  IconLayoutGrid,
  IconPhoto,
  IconRefresh,
  IconSparkles,
  IconStar,
  IconUpload,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { UiIcon } from "../../components/ui-icon";
import { workspaceTools } from "../workspace/workspace-state";
import { toolIcons } from "../workspace/workspace-tool-symbol";
import {
  type AssetLibraryFilters,
  type AssetMediaType,
  filtersApply,
  sameFilters,
} from "./asset-library-client";

const libraryTools = workspaceTools;
export const toolNames = Object.fromEntries(
  libraryTools.map((tool) => [tool.id, tool.name]),
) as Record<AssetTool, string>;
const sources = [
  { id: "generated", label: "生成素材", icon: IconPhoto },
  { id: "uploads", label: "上传素材", icon: IconUpload },
  { id: "favorites", label: "收藏素材", icon: IconStar },
] as const;
const mediaTypes: { id: AssetMediaType; label: string; compact: string }[] = [
  { id: "all", label: "全部", compact: "全部类型" },
  { id: "image", label: "图片", compact: "图片" },
  { id: "video", label: "视频", compact: "视频" },
];

const timeOptions = [
  { id: "all", label: "全部时间" },
  { id: "today", label: "今天" },
  { id: "7", label: "最近 7 天" },
  { id: "30", label: "最近 30 天" },
  { id: "90", label: "最近 90 天" },
] as const;

/** 功能 / 类型 / 模型 for the selected source; changing any of them restarts paging. */
export function AssetFilters({
  filters,
  defaults,
  currentTool,
  models,
  loaded,
  compact,
  mediaSelect = false,
  showSource = false,
  displayControls,
  onChange,
}: {
  filters: AssetLibraryFilters;
  defaults: AssetLibraryFilters;
  currentTool?: AssetTool | undefined;
  models: readonly { id: string; name: string }[];
  loaded: number | null;
  compact: boolean;
  mediaSelect?: boolean;
  showSource?: boolean;
  displayControls?: ReactNode;
  onChange: (filters: AssetLibraryFilters) => void;
}) {
  const disabled = !filtersApply(filters);
  const set = (patch: Partial<AssetLibraryFilters>) => onChange({ ...filters, ...patch });
  const ToolIcon = filters.tool === "all" ? IconLayoutGrid : toolIcons[filters.tool];
  const SourceIcon = sources.find((source) => source.id === filters.source)?.icon ?? IconPhoto;
  const reset = { ...defaults, source: filters.source };
  return (
    <div className="asset-filters">
      {showSource && (
        <Select
          className="asset-filter"
          aria-label="素材来源"
          value={filters.source}
          onChange={(key) => {
            const source = sources.find((entry) => entry.id === key)?.id;
            if (source) set({ source });
          }}
        >
          <Select.Trigger className="asset-filter-trigger">
            <UiIcon icon={SourceIcon} className="asset-filter-lead" />
            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
            <ListBox aria-label="素材来源">
              {sources.map((source) => (
                <ListBox.Item
                  className="model-options"
                  key={source.id}
                  id={source.id}
                  textValue={source.label}
                >
                  <UiIcon icon={source.icon} />
                  <span>{source.label}</span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
      <Select
        className="asset-filter"
        aria-label="功能"
        value={filters.tool}
        isDisabled={disabled}
        onChange={(key) => {
          const tool = libraryTools.find((entry) => entry.id === key)?.id;
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
            {libraryTools.map((tool) => (
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
      {compact || mediaSelect ? (
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
      {mediaSelect && (
        <Select
          className="asset-filter"
          aria-label="时间"
          value={filters.time ?? "all"}
          onChange={(key) => {
            const time = timeOptions.find((option) => option.id === key)?.id;
            if (time) set({ time });
          }}
        >
          <Select.Trigger
            className="asset-filter-trigger"
            data-active={(!!filters.time && filters.time !== "all") || undefined}
          >
            <UiIcon icon={IconCalendar} className="asset-filter-lead" />
            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
            <ListBox aria-label="时间">
              {timeOptions.map((option) => (
                <ListBox.Item
                  className="model-options"
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                >
                  <span>{option.label}</span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
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
      {displayControls}
      {loaded !== null && !compact && (
        <span className="asset-filter-meta">
          已加载 <b>{loaded}</b> 项
        </span>
      )}
    </div>
  );
}
