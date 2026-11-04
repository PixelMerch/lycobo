import { Button } from "@heroui/react";
import { MotionConfig, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { shareProductReference, toolForPath, workspaceTools } from "./workspace-state";
import { WorkspaceToolSymbol } from "./workspace-tool-symbol";

export function WorkspaceToolPicker() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = toolForPath(pathname);
  return (
    <MotionConfig reducedMotion="user">
      <motion.nav layoutScroll className="workspace-tool-bar" aria-label="电商创作工具">
        {workspaceTools.map((tool) => (
          <Button
            key={tool.id}
            size="sm"
            variant="tertiary"
            className="workspace-tool-shortcut"
            data-tool={tool.id}
            aria-label={tool.name}
            aria-current={current.id === tool.id ? "page" : false}
            onPress={() => {
              shareProductReference(pathname, tool.path);
              navigate(tool.path);
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
              <span className="workspace-tool-name">{tool.name}</span>
            </span>
          </Button>
        ))}
      </motion.nav>
    </MotionConfig>
  );
}
