import { Tooltip } from "@heroui/react";
import { IconFolderSparkle, IconLayoutGrid } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";

const entries = [
  { to: "/workspace", label: "工作区", icon: IconLayoutGrid },
  { to: "/assets", label: "素材库", icon: IconFolderSparkle },
];

/** 首页左侧悬浮快捷入口：工作区与素材库，未登录时同样先进入登录页。 */
export function HomeDock() {
  return (
    <nav className="home-dock" aria-label="快捷入口">
      {entries.map((entry) => (
        <Tooltip key={entry.to} delay={200}>
          <RouteLink to={entry.to} className="home-dock-link" aria-label={entry.label}>
            <UiIcon icon={entry.icon} size="action" />
          </RouteLink>
          <Tooltip.Content placement="right">{entry.label}</Tooltip.Content>
        </Tooltip>
      ))}
    </nav>
  );
}
