import { MotionConfig } from "motion/react";
import { useAppLocation } from "../../../i18n/use-localized-navigation";
import { commerceToolFromSearch } from "../../commerce/commerce-tools";
import { Cases } from "./cases";
import { FinalCta } from "./final-cta";
import { Formats } from "./formats";
import { Hero } from "./hero";
import { SiteFooter } from "./site-footer";
import { Workflow } from "./workflow";
import "./landing.css";

/** 电商专区保留既有展示区块，首屏按地址选择创作工具。 */
export function CommerceLanding() {
  const tool = commerceToolFromSearch(useAppLocation().search);
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <div className="lp-page" data-lp-theme="figma">
          <div className="lp-main">
            <Hero tool={tool} />
            <Cases />
            <Workflow />
            <Formats />
            <FinalCta />
          </div>
          <SiteFooter />
        </div>
      </div>
    </MotionConfig>
  );
}
