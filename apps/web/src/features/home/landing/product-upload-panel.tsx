import { TextArea } from "@heroui/react";
import {
  IconAdjustmentsHorizontal,
  IconArrowUp,
  IconPlus,
  IconShoppingBag,
} from "@tabler/icons-react";
import { type RefObject, useEffect } from "react";
import { useLocation } from "react-router";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import type { CommerceTool } from "../../commerce/commerce-tools";
import { landingMessages } from "./landing-messages";

/** 展示当前电商工具与创作入口；输入框只做本地展示，不提交真实任务。 */
export function ProductUploadPanel({
  panelRef,
  tool,
}: {
  panelRef: RefObject<HTMLElement | null>;
  tool: CommerceTool;
}) {
  const t = useMessages(landingMessages).composer;
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#commerce-composer") {
      panelRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [location, panelRef]);

  return (
    <section id="commerce-composer" className="lp-uploadPanel" aria-label={t.start} ref={panelRef}>
      <div className="lp-promptRow">
        <RouteLink aria-label={t.addMedia} className="lp-workspaceAdd" to={tool.href}>
          <UiIcon icon={IconPlus} size="action" />
        </RouteLink>
        <div className="lp-promptEditor">
          <span className="lp-modeChip">{t.replica}</span>
          <TextArea
            aria-label={t.placeholder}
            className="lp-promptInput"
            placeholder={t.placeholder}
          />
        </div>
      </div>
      <div className="lp-promptFooter">
        <div className="lp-promptChips">
          <span>
            <UiIcon icon={IconShoppingBag} size="small" />
            {t.product}
          </span>
          <span>
            <UiIcon icon={IconAdjustmentsHorizontal} size="small" />
            {t.settings}
          </span>
        </div>
        <RouteLink aria-label={t.start} className="lp-workspaceCta" to={tool.href}>
          <UiIcon icon={IconArrowUp} size="default" />
        </RouteLink>
      </div>
    </section>
  );
}
