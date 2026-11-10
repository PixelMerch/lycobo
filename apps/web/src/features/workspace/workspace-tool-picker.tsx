import { Button } from "@heroui/react";
import { MotionConfig, motion } from "motion/react";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { shareProductReference, toolForPath, workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { WorkspaceToolSymbol } from "./workspace-tool-symbol";

/** 工作区顶部的工具切换栏：切换时只向空图片槽带入商品图。 */
export function WorkspaceToolPicker() {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const current = toolForPath(pathname);
  const t = useMessages(workspaceToolMessages);
  return (
    <MotionConfig reducedMotion="user">
      <motion.nav layoutScroll className="workspace-tool-bar" aria-label={t.toolBar}>
        {workspaceTools.map((tool) => (
          <Button
            key={tool.id}
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
        ))}
      </motion.nav>
    </MotionConfig>
  );
}
