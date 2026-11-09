import { Tooltip } from "@heroui/react";
import { IconFolderSparkle, IconLayoutGrid, IconSmartHome } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { homeMessages } from "./home-messages";

// 首页入口只在手机底部横条里出现（与 vidmuse 一致），桌面左侧悬浮条只放工作区与素材库。
const entries = [
  { id: "home", to: "/", icon: IconSmartHome, phoneOnly: true },
  { id: "workspace", to: "/workspace", icon: IconLayoutGrid, phoneOnly: false },
  { id: "assets", to: "/assets", icon: IconFolderSparkle, phoneOnly: false },
] as const;

/** 首页快捷入口：桌面在左侧悬浮，手机改成带文字的底部横条；未登录时同样先进入登录页。 */
export function HomeDock() {
  const t = useMessages(homeMessages);
  return (
    <nav className="home-dock" aria-label={t.shortcuts}>
      {entries.map((entry) => (
        <Tooltip key={entry.to} delay={200}>
          <RouteLink
            nav
            end
            to={entry.to}
            className={`home-dock-link${entry.phoneOnly ? " home-dock-link--phone" : ""}`}
            aria-label={t.dock[entry.id]}
          >
            <UiIcon icon={entry.icon} size="action" />
            <span className="home-dock-label" aria-hidden="true">
              {t.dock[entry.id]}
            </span>
          </RouteLink>
          <Tooltip.Content placement="right">{t.dock[entry.id]}</Tooltip.Content>
        </Tooltip>
      ))}
    </nav>
  );
}
