import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useMessages } from "../../i18n/messages";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { textileViews } from "../commerce/textile-set/textile-views";
import { homeMessages } from "./home-messages";
import "./home-textile-views.css";

/** 首页直接勾选裂变视角，与工作区的“裂变类型”共用同一份家纺草稿。 */
export function HomeTextileViews() {
  const views = useTextileSetDraft((s) => s.views);
  const update = useTextileSetDraft((s) => s.update);
  const t = useMessages(homeMessages);
  return (
    <div className="home-textile-views">
      <p className="home-textile-views-title">
        {t.chooseViews}
        <span className="home-textile-views-count">{t.viewsSelected(views.length)}</span>
      </p>
      <ToggleButtonGroup
        aria-label={t.views}
        className="home-textile-view-options"
        isDetached
        selectionMode="multiple"
        selectedKeys={views}
        onSelectionChange={(keys) =>
          update({
            views: textileViews.filter((view) => keys.has(view.id)).map((view) => view.id),
          })
        }
      >
        {textileViews.map((view) => (
          <ToggleButton key={view.id} id={view.id} size="sm">
            {view.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
