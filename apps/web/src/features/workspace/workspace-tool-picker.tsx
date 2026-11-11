import { Button, Tooltip } from "@heroui/react";
import { MotionConfig, motion } from "motion/react";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { shareProductReference, toolForPath, visibleWorkspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { WorkspaceToolSymbol } from "./workspace-tool-symbol";
import { useWorkspaceView } from "./workspace-view-preferences";

/** 工具切换不弹示例；收起时只提示名称，保留原有草稿切换规则。 */
export function WorkspaceToolPicker() {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const current = toolForPath(pathname);
  const t = useMessages(workspaceToolMessages);
  const collapsed = useWorkspaceView((state) => state.toolRailCollapsed);
  return (
    <MotionConfig reducedMotion="user">
      <motion.nav layoutScroll className="workspace-tool-bar" aria-label={t.toolBar}>
        {visibleWorkspaceTools.map((tool) => (
          <Tooltip key={tool.id} delay={300} closeDelay={80} isDisabled={!collapsed}>
            <Button
              size="sm"
              variant="tertiary"
              className="workspace-tool-shortcut"
              data-tool={tool.id}
              aria-label={t.tools[tool.id].name}
              aria-current={current.id === tool.id ? "page" : false}
              onPress={() => {
                shareProductReference(pathname, tool.path);
                void navigate(tool.path);
              }}
            >
              {current.id === tool.id && (
                <motion.span
                  layoutId="workspace-tool-indicator"
                  className="workspace-tool-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              <WorkspaceToolSymbol tool={tool.id} />
              <span className="workspace-tool-label">
                <span className="workspace-tool-name">{t.tools[tool.id].name}</span>
              </span>
            </Button>
            <Tooltip.Content placement="right">{t.tools[tool.id].name}</Tooltip.Content>
          </Tooltip>
        ))}
      </motion.nav>
    </MotionConfig>
  );
}
