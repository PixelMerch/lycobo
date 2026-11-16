import { motion } from "motion/react";
import { useRef } from "react";
import { RouteLink } from "../../../components/router-link";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";
import { useCommerceScrollReveal } from "./use-commerce-scroll-reveal";

const views = ["scene", "alternate"] as const;

/** 并排呈现同款商品的两种布景，并连接现有创作工具。 */
export function ProductScenes() {
  const { scenes, shots } = useMessages(commerceShowcaseMessages);
  const photos = useRef<HTMLDivElement>(null);
  const reveal = useCommerceScrollReveal(photos, 88, 0.94, "center center");

  return (
    <section className="commerce-scenes" aria-labelledby="commerce-results-title">
      <div className="commerce-section commerce-scenes-layout">
        <div className="commerce-scenes-copy">
          <h2 id="commerce-results-title">{scenes.title}</h2>
          <div className="commerce-scenes-links">
            <RouteLink to="/commerce/create" className="commerce-text-link">
              {scenes.create}
            </RouteLink>
            <RouteLink to="/commerce/replica" className="commerce-text-link">
              {scenes.style}
            </RouteLink>
          </div>
        </div>
        <motion.div ref={photos} className="commerce-scenes-photos" style={reveal}>
          {views.map((view) => (
            <figure key={view}>
              <ProductFrame view={view} />
              <figcaption>{shots[view]}</figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
