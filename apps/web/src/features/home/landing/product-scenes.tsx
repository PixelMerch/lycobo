import { IconArrowUpRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";

const views = ["scene", "alternate"] as const;

/** 并排呈现同款商品的两种布景，并连接现有创作工具。 */
export function ProductScenes() {
  const { scenes, shots } = useMessages(commerceShowcaseMessages);

  return (
    <section className="commerce-scenes" aria-labelledby="commerce-results-title">
      <div className="commerce-section commerce-scenes-layout">
        <div className="commerce-scenes-copy">
          <h2 id="commerce-results-title">{scenes.title}</h2>
          <p>{scenes.description}</p>
          <div className="commerce-scenes-links">
            <RouteLink to="/commerce/create" className="commerce-text-link">
              {scenes.create}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
            <RouteLink to="/commerce/replica" className="commerce-text-link">
              {scenes.style}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>
        </div>
        <div className="commerce-scenes-photos">
          {views.map((view) => (
            <figure key={view}>
              <ProductFrame view={view} />
              <figcaption>{shots[view]}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
