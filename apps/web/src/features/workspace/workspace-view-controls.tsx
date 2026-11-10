import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import {
  IconLayoutGrid,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSquare,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigationType } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { useWorkspaceView } from "./workspace-view-preferences";

/** 参数栏右上角的收起按钮；收起后同一个按钮变成整条 56px 窄边，点哪里都能展开。 */
export function ComposerCollapseToggle() {
  const t = useMessages(workspaceToolMessages);
  const collapsed = useWorkspaceView((state) => state.composerCollapsed);
  const setCollapsed = useWorkspaceView((state) => state.setComposerCollapsed);
  const label = collapsed ? t.expandComposer : t.collapseComposer;
  return (
    // 收起后按钮占满整条窄边，提示气泡会落在屏幕中间，所以只在展开时显示提示。
    <Tooltip delay={0} isDisabled={collapsed}>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        className="workspace-composer-toggle"
        aria-label={label}
        aria-expanded={!collapsed}
        onPress={() => setCollapsed(!collapsed)}
      >
        <UiIcon
          icon={collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse}
          size="default"
        />
      </Button>
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  );
}

const densityIcons = { large: IconSquare, compact: IconLayoutGrid };

/** 工具栏右侧的历史视图切换：大图或紧凑，选择记在本机。 */
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

/** 从首页等别的页面跳进工作台时展开参数栏，先让用户看到带过来的草稿；刷新页面保持本机记住的状态。 */
export function useRevealComposerOnEntry() {
  const navigationType = useNavigationType();
  // 只看进入工作台那一刻的跳转方式（刷新和前进后退是 POP），之后在工作台里切换工具不再自动展开。
  const [entry] = useState(navigationType);
  const setCollapsed = useWorkspaceView((state) => state.setComposerCollapsed);
  useEffect(() => {
    if (entry !== "POP") setCollapsed(false);
  }, [entry, setCollapsed]);
}
