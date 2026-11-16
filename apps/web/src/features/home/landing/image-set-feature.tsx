import { IconArrowUpRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetBoard } from "./image-set-board";

const views = ["studio", "detail", "base", "scene"] as const;

/** 展示同一款商品的主图和各处细节，并保留套图计划入口。 */
export function ImageSetFeature() {
  const { set, shots } = useMessages(commerceShowcaseMessages);

  return (
    <section className="commerce-sets-story" aria-labelledby="commerce-set-title">
      <div className="commerce-section">
        <div className="commerce-set-header">
          <h2 id="commerce-set-title">{set.title}</h2>
          <div>
            <p>{set.description}</p>
            <RouteLink to="/commerce/smart-variation" className="commerce-text-link">
              {set.action}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>
        </div>
        <ImageSetBoard views={views} labels={shots} chooseLabel={set.views} />
      </div>
    </section>
  );
}
