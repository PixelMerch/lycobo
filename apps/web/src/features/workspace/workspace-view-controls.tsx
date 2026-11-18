import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import {
  IconLayoutGrid,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSquare,
} from "@tabler/icons-react";
import { useRef } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { useWorkspaceView } from "./workspace-view-preferences";

/** 左侧工具栏切换按钮，通过短暂波纹反馈收展。 */
export function ToolRailCollapseToggle() {
  const t = useMessages(workspaceToolMessages);
  const collapsed = useWorkspaceView((state) => state.toolRailCollapsed);
  const setCollapsed = useWorkspaceView((state) => state.setToolRailCollapsed);
  const activeRipple = useRef<Animation | null>(null);
  const label = collapsed ? t.expandToolRail : t.collapseToolRail;
  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        className="workspace-composer-toggle"
        aria-label={label}
        aria-expanded={!collapsed}
        onPress={(event) => {
          setCollapsed(!collapsed);
          activeRipple.current?.cancel();
          if (
            event.pointerType === "keyboard" ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            return;
          }
          const ripple = event.target
            .closest(".workspace-tool-dock")
            ?.querySelector(".workspace-tool-rail-ripple");
          activeRipple.current =
            ripple?.animate(
              [
                { opacity: 0, scale: "1" },
                { opacity: 0.65, scale: "1.02 1.12", offset: 0.3 },
                { opacity: 0.25, scale: "1.05 1.04", offset: 0.6 },
                { opacity: 0, scale: "1.12 1.24" },
              ],
              { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
            ) ?? null;
        }}
      >
        <UiIcon
          icon={collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse}
          size="default"
        />
      </Button>
      <Tooltip.Content placement="right">{label}</Tooltip.Content>
    </Tooltip>
  );
}

const densityIcons = { large: IconSquare, compact: IconLayoutGrid };

/** “生成记录”标题行右侧的历史视图切换：大图或紧凑，选择记在本机。 */
export function HistoryDensityToggle() {
  const t = useMessages(workspaceToolMessages);
  const density = useWorkspaceView((state) => state.density);
  const setDensity = useWorkspaceView((state) => state.setDensity);
  const options = [
    { id: "large", label: t.largeView },
    { id: "compact", label: t.compactView },
  ] as const;
  return (
    <ToggleButtonGroup
      isDetached
      size="sm"
      className="workspace-density-toggle"
      aria-label={t.historyDensity}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[density]}
      onSelectionChange={(keys) => {
        const key = Array.from(keys)[0];
        if (key === "large" || key === "compact") setDensity(key);
      }}
    >
      {options.map((option) => (
        <Tooltip key={option.id} delay={0}>
          <ToggleButton
            id={option.id}
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={option.label}
          >
            <UiIcon icon={densityIcons[option.id]} size="default" />
          </ToggleButton>
          <Tooltip.Content placement="bottom">{option.label}</Tooltip.Content>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
