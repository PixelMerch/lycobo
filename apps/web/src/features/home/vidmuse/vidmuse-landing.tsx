import { MotionConfig } from "motion/react";
import { Cases } from "./cases";
import { FinalCta } from "./final-cta";
import { Formats } from "./formats";
import { Hero } from "./hero";
import { LandingScrollbar } from "./landing-scrollbar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { Workflow } from "./workflow";
import "./vidmuse.css";

/** 首页 vidmuse 复刻：保留参考页的头尾、橙红主题和全部展示区块；暂不接入真实生成。 */
export function VidmuseLanding() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="vidmuse-landing">
        <div className="vm-page" data-vm-theme="figma">
          <SiteHeader />
          <main className="vm-main">
            <Hero />
            <Cases />
            <Workflow />
            <Formats />
            <FinalCta />
          </main>
          <SiteFooter />
          <LandingScrollbar />
        </div>
      </div>
    </MotionConfig>
  );
}
