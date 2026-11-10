import { Button, Tooltip } from "@heroui/react";
import { IconFolderSparkle, IconLayoutGrid, IconSmartHome } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useOpenAssetLibrary } from "../assets/asset-library-store";
import { homeMessages } from "./home-messages";

// 首页入口只在手机底部横条里出现（与 vidmuse 一致），桌面左侧悬浮条只放工作区与素材库。
const links = [
  { id: "home", to: "/", icon: IconSmartHome, phoneOnly: true },
  { id: "workspace", to: "/workspace", icon: IconLayoutGrid, phoneOnly: false },
] as const;

/**
 * 首页快捷入口：桌面在左侧悬浮，手机改成带文字的底部横条。首页与工作区是链接；素材库直接打开弹窗、
 * 不跳转页面（用户 2026-11-10 要求）。未登录时同样先进入登录页。
 */
export function HomeDock() {
  const t = useMessages(homeMessages);
  const openLibrary = useOpenAssetLibrary();
  return (
    <nav className="home-dock" aria-label={t.shortcuts}>
      {links.map((entry) => (
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
      <Tooltip delay={200}>
        <Button
          variant="ghost"
          className="home-dock-link"
          aria-label={t.dock.assets}
          onPress={(event) => openLibrary(event.target)}
        >
          <UiIcon icon={IconFolderSparkle} size="action" />
          <span className="home-dock-label" aria-hidden="true">
            {t.dock.assets}
          </span>
        </Button>
        <Tooltip.Content placement="right">{t.dock.assets}</Tooltip.Content>
      </Tooltip>
    </nav>
  );
}
