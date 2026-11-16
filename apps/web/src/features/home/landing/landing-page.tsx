import { MotionConfig } from "motion/react";
import { useRef } from "react";
import { useAppLocation } from "../../../i18n/use-localized-navigation";
import { commerceToolFromSearch } from "../../commerce/commerce-tools";
import { FinalCta } from "./final-cta";
import { Formats } from "./formats";
import { Hero } from "./hero";
import { ImageSetFeature } from "./image-set-feature";
import { ProblemProcess } from "./problem-process";
import { ProductIntro } from "./product-intro";
import { ProductScenes } from "./product-scenes";
import { SiteFooter } from "./site-footer";
import "./landing.css";

/** 电商专区从首屏进入同款商品的流程、样片、模板与创作入口。 */
export function CommerceLanding() {
  const tool = commerceToolFromSearch(useAppLocation().search);
  const composerRef = useRef<HTMLElement>(null);
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <div className="lp-page commerce-landing">
          <div className="lp-main">
            <Hero composerRef={composerRef} tool={tool} />
            <div className="commerce-body">
              <ProductIntro />
              <ProblemProcess />
              <ProductScenes />
              <ImageSetFeature />
              <Formats />
              <FinalCta onStart={() => composerRef.current?.scrollIntoView({ block: "center" })} />
            </div>
          </div>
          <SiteFooter />
        </div>
      </div>
    </MotionConfig>
  );
}
