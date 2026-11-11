import {
  Header,
  Label,
  ListBox,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import type { AssetTool } from "@lycoboai/contracts";
import {
  IconCalendar,
  IconLayoutGrid,
  IconMovie,
  IconPhoto,
  IconSparkles,
  IconUpload,
  type TablerIcon,
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
  type AssetSource,
  type AssetTimeRange,
  assetTimeRanges,
} from "./asset-library-client";
import { assetsMessages } from "./assets-messages";

/** 素材所属工具的名称；未知工具显示“生成”。 */
export function assetToolName(tool: AssetTool, locale: Locale = currentLocale()) {
  const known = workspaceTools.find((entry) => entry.id === tool);
  if (!known) return assetsMessages[locale].generatedFallback;
  return workspaceToolMessages[locale].tools[known.id].name;
}

// 来源菜单的一项：全部来源、我上传的、全部 AI 生成，或者 AI 生成里的某个功能。
type SourceKey = AssetSource | AssetTool;
const sourceIcons = {
  all: IconLayoutGrid,
  uploads: IconUpload,
  generated: IconSparkles,
} satisfies Record<AssetSource, TablerIcon>;
const sourceKeys: SourceKey[] = [
  "all",
  "uploads",
  "generated",
  ...workspaceTools.map((tool) => tool.id),
];
const mediaTypes = [
  { id: "image", icon: IconPhoto },
  { id: "video", icon: IconMovie },
] as const satisfies readonly { id: AssetMediaType; icon: TablerIcon }[];

const isSource = (key: SourceKey): key is AssetSource =>
  key === "all" || key === "uploads" || key === "generated";

function sourceKey(filters: AssetLibraryFilters): SourceKey {
  return filters.source === "generated" && filters.tool !== "all" ? filters.tool : filters.source;
}

function filtersForKey(key: SourceKey): Pick<AssetLibraryFilters, "source" | "tool"> {
  return isSource(key) ? { source: key, tool: "all" } : { source: "generated", tool: key };
}

/**
 * 我的素材的筛选行：图片或视频、来源（AI 生成可直接选功能）、时间、仅看收藏，末尾放多选入口或多选操作条；
 * 改动任一项都会从头分页。
 */
export function AssetFilters({
  filters,
  currentTool,
  trailing,
  onChange,
}: {
  filters: AssetLibraryFilters;
  currentTool?: AssetTool | undefined;
  trailing: ReactNode;
  onChange: (filters: AssetLibraryFilters) => void;
}) {
  const t = useMessages(assetsMessages);
  const set = (patch: Partial<AssetLibraryFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="asset-filters">
      <ToggleButtonGroup
        aria-label={t.type}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[filters.type]}
        onSelectionChange={(keys) => {
          const type = mediaTypes.find((entry) => keys.has(entry.id));
          if (type) set({ type: type.id });
        }}
        className="asset-segment"
      >
        {mediaTypes.map((type) => (
          <ToggleButton key={type.id} id={type.id}>
            <UiIcon icon={type.icon} size="small" />
            {t.mediaTypes[type.id]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <AssetSourceMenu filters={filters} currentTool={currentTool} onChange={set} />
      <AssetTimeMenu time={filters.time} onChange={(time) => set({ time })} />
      <Switch
        className="asset-favorite-filter"
        isSelected={filters.favorite}
        onChange={(favorite) => set({ favorite })}
      >
        <Switch.Content>
          <Label>{t.favoritesOnly}</Label>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <span className="asset-filters-end">{trailing}</span>
    </div>
  );
}

/** 来源菜单：全部来源、我上传的，以及“AI 生成”分组（全部 AI 生成和各个功能，当前功能标“当前”）。 */
function AssetSourceMenu({
  filters,
  currentTool,
  onChange,
}: {
  filters: AssetLibraryFilters;
  currentTool?: AssetTool | undefined;
  onChange: (patch: Pick<AssetLibraryFilters, "source" | "tool">) => void;
}) {
  const t = useMessages(assetsMessages);
  const toolText = useMessages(workspaceToolMessages).tools;
  const key = sourceKey(filters);
  const label = (entry: SourceKey) => (isSource(entry) ? t.sources[entry] : toolText[entry].name);
  const icon = (entry: SourceKey) => (isSource(entry) ? sourceIcons[entry] : toolIcons[entry]);
  const option = (entry: SourceKey, text: string) => (
    <ListBox.Item key={entry} id={entry} textValue={text}>
      <UiIcon icon={icon(entry)} />
      <span>{text}</span>
      {entry === currentTool && <span className="asset-filter-now">{t.currentTool}</span>}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
  return (
    <Select
      className="asset-filter"
      aria-label={t.source}
      value={key}
      onChange={(next) => {
        const match = sourceKeys.find((entry) => entry === next);
        if (match) onChange(filtersForKey(match));
      }}
    >
      <Select.Trigger className="asset-filter-trigger" data-active={key !== "all" || undefined}>
        <UiIcon icon={icon(key)} className="asset-filter-lead" />
        <Select.Value>{() => label(key)}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="choice-menu" placement="bottom start" offset={4}>
        <ListBox aria-label={t.source}>
          {option("all", t.sources.all)}
          {option("uploads", t.sources.uploads)}
          <ListBox.Section className="asset-filter-section">
            <Header className="asset-filter-heading">{t.sources.generated}</Header>
            {option("generated", t.allGenerated)}
            {workspaceTools.map((tool) => option(tool.id, toolText[tool.id].name))}
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** 时间菜单：全部时间、今天、最近 7／30／90 天；选了时间范围，列表才按天分组。 */
function AssetTimeMenu({
  time,
  onChange,
}: {
  time: AssetTimeRange;
  onChange: (time: AssetTimeRange) => void;
}) {
  const t = useMessages(assetsMessages);
  return (
    <Select
      className="asset-filter"
      aria-label={t.time}
      value={time}
      onChange={(next) => {
        const match = assetTimeRanges.find((entry) => entry === next);
        if (match) onChange(match);
      }}
    >
      <Select.Trigger className="asset-filter-trigger" data-active={time !== "all" || undefined}>
        <UiIcon icon={IconCalendar} className="asset-filter-lead" />
        <Select.Value>{() => t.times[time]}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="choice-menu" placement="bottom start" offset={4}>
        <ListBox aria-label={t.time}>
          {assetTimeRanges.map((option) => (
            <ListBox.Item key={option} id={option} textValue={t.times[option]}>
              <span>{t.times[option]}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
