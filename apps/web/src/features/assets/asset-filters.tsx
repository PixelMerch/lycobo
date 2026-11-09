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
import type { Locale } from "../../i18n/locale";
import { currentLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { toolIcons } from "../workspace/workspace-tool-symbol";
import {
  type AssetLibraryFilters,
  type AssetMediaType,
  filtersApply,
  sameFilters,
} from "./asset-library-client";

import { assetsMessages } from "./assets-messages";

const libraryTools = workspaceTools;
/** 素材所属工具的名称；未知工具显示“生成”。 */
export function assetToolName(tool: AssetTool, locale: Locale = currentLocale()) {
  const known = workspaceTools.find((entry) => entry.id === tool);
  if (!known) return assetsMessages[locale].generatedFallback;
  return workspaceToolMessages[locale].tools[known.id].name;
}
const sources = [
  { id: "generated", icon: IconPhoto },
  { id: "uploads", icon: IconUpload },
  { id: "favorites", icon: IconStar },
] as const;
const mediaTypes: AssetMediaType[] = ["all", "image", "video"];
const timeOptions = ["all", "today", "7", "30", "90"] as const;
type AssetsText = (typeof assetsMessages)[Locale];

/** 当前来源的功能、类型与模型筛选；改动任一项都会从头分页。 */
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
  const t = useMessages(assetsMessages);
  const toolText = useMessages(workspaceToolMessages).tools;
  const disabled = !filtersApply(filters);
  const set = (patch: Partial<AssetLibraryFilters>) => onChange({ ...filters, ...patch });
  const ToolIcon = filters.tool === "all" ? IconLayoutGrid : toolIcons[filters.tool];
  const reset = { ...defaults, source: filters.source };
  return (
    <div className="asset-filters">
      {showSource && <AssetSourceFilter source={filters.source} set={set} t={t} />}
      <Select
        className="asset-filter"
        aria-label={t.tool}
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
          <ListBox aria-label={t.tool}>
            <ListBox.Item className="model-options" id="all" textValue={t.allTools}>
              <UiIcon icon={IconLayoutGrid} />
              <span>{t.allTools}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {libraryTools.map((tool) => (
              <ListBox.Item
                className="model-options"
                key={tool.id}
                id={tool.id}
                textValue={toolText[tool.id].name}
              >
                <UiIcon icon={toolIcons[tool.id]} />
                <span>{toolText[tool.id].name}</span>
                {tool.id === currentTool && (
                  <span className="asset-filter-now">{t.currentTool}</span>
                )}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <AssetMediaFilter type={filters.type} dropdown={compact || mediaSelect} set={set} t={t} />
      <Select
        className="asset-filter"
        aria-label={t.model}
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
          <ListBox aria-label={t.model}>
            <ListBox.Item className="model-options" id="all" textValue={t.allModels}>
              <span>{t.allModels}</span>
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
      {mediaSelect && <AssetTimeFilter time={filters.time} set={set} t={t} />}
      {!sameFilters(filters, reset) && (
        <Button
          size="sm"
          variant="ghost"
          className="asset-filter-reset"
          onPress={() => onChange(reset)}
        >
          <UiIcon icon={IconRefresh} size="small" />
          {t.resetFilters}
        </Button>
      )}
      {disabled && !compact && <span className="asset-filter-hint">{t.uploadsNoFilters}</span>}
      {displayControls}
      {loaded !== null && !compact && (
        <span className="asset-filter-meta">
          {t.loadedBefore}
          <b>{loaded}</b>
          {t.loadedAfter}
        </span>
      )}
    </div>
  );
}

type SetAssetFilters = (patch: Partial<AssetLibraryFilters>) => void;

function AssetSourceFilter({
  source,
  set,
  t,
}: {
  source: AssetLibraryFilters["source"];
  set: SetAssetFilters;
  t: AssetsText;
}) {
  const SourceIcon = sources.find((entry) => entry.id === source)?.icon ?? IconPhoto;
  return (
    <Select
      className="asset-filter"
      aria-label={t.source}
      value={source}
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
        <ListBox aria-label={t.source}>
          {sources.map((source) => (
            <ListBox.Item
              className="model-options"
              key={source.id}
              id={source.id}
              textValue={t.sources[source.id]}
            >
              <UiIcon icon={source.icon} />
              <span>{t.sources[source.id]}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function AssetMediaFilter({
  type,
  dropdown,
  set,
  t,
}: {
  type: AssetMediaType;
  dropdown: boolean;
  set: SetAssetFilters;
  t: AssetsText;
}) {
  if (dropdown)
    return (
      <Select
        className="asset-filter"
        aria-label={t.type}
        value={type}
        onChange={(key) => {
          const type = mediaTypes.find((entry) => entry === key);
          if (type) set({ type });
        }}
      >
        <Select.Trigger className="asset-filter-trigger" data-active={type !== "all" || undefined}>
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
          <ListBox aria-label={t.type}>
            {mediaTypes.map((type) => (
              <ListBox.Item
                className="model-options"
                key={type}
                id={type}
                textValue={t.mediaTypes[type].compact}
              >
                <span>{t.mediaTypes[type].compact}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  return (
    <ToggleButtonGroup
      aria-label={t.type}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[type]}
      onSelectionChange={(keys) => {
        const type = mediaTypes.find((entry) => keys.has(entry));
        if (type) set({ type });
      }}
      className="asset-segment"
    >
      {mediaTypes.map((type) => (
        <ToggleButton key={type} id={type}>
          {t.mediaTypes[type].label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function AssetTimeFilter({
  time,
  set,
  t,
}: {
  time: AssetLibraryFilters["time"];
  set: SetAssetFilters;
  t: AssetsText;
}) {
  return (
    <Select
      className="asset-filter"
      aria-label={t.time}
      value={time ?? "all"}
      onChange={(key) => {
        const time = timeOptions.find((option) => option === key);
        if (time) set({ time });
      }}
    >
      <Select.Trigger
        className="asset-filter-trigger"
        data-active={(!!time && time !== "all") || undefined}
      >
        <UiIcon icon={IconCalendar} className="asset-filter-lead" />
        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="model-menu asset-filter-menu" placement="bottom start">
        <ListBox aria-label={t.time}>
          {timeOptions.map((option) => (
            <ListBox.Item
              className="model-options"
              key={option}
              id={option}
              textValue={t.times[option]}
            >
              <span>{t.times[option]}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
