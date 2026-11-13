import { MotionConfig } from "motion/react";
import { Cases } from "./cases";
import { FinalCta } from "./final-cta";
import { Formats } from "./formats";
import { Hero } from "./hero";
import { SiteFooter } from "./site-footer";
import { Workflow } from "./workflow";
import "./landing.css";

/** 首页展示原型：组合参考页的区块与 Lycobo 品牌主题。 */
export function HomeLanding() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <div className="lp-page" data-lp-theme="figma">
          <main className="lp-main">
            <Hero />
            <Cases />
            <Workflow />
            <Formats />
            <FinalCta />
          </main>
          <SiteFooter />
        </div>
      </div>
    </MotionConfig>
  );
}
