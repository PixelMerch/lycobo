import { Tooltip } from "@heroui/react";
import { IconFolderSparkle, IconLayoutGrid, IconSmartHome } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";

// 首页入口只在手机底部横条里出现（与 vidmuse 一致），桌面左侧悬浮条只放工作区与素材库。
const entries = [
  { to: "/", label: "首页", icon: IconSmartHome, phoneOnly: true },
  { to: "/workspace", label: "工作区", icon: IconLayoutGrid, phoneOnly: false },
  { to: "/assets", label: "素材库", icon: IconFolderSparkle, phoneOnly: false },
];

/** 首页快捷入口：桌面在左侧悬浮，手机改成带文字的底部横条；未登录时同样先进入登录页。 */
export function HomeDock() {
  return (
    <nav className="home-dock" aria-label="快捷入口">
      {entries.map((entry) => (
        <Tooltip key={entry.to} delay={200}>
          <RouteLink
            nav
            end
            to={entry.to}
            className={`home-dock-link${entry.phoneOnly ? " home-dock-link--phone" : ""}`}
            aria-label={entry.label}
          >
            <UiIcon icon={entry.icon} size="action" />
            <span className="home-dock-label" aria-hidden="true">
              {entry.label}
            </span>
          </RouteLink>
          <Tooltip.Content placement="right">{entry.label}</Tooltip.Content>
        </Tooltip>
      ))}
    </nav>
  );
}
