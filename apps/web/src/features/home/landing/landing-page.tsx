import { useEffect, useLayoutEffect } from "react";
import { useMessages } from "../../../i18n/messages";
import { useAppLocation } from "../../../i18n/use-localized-navigation";
import { SiteFooter } from "../../site/site-footer";
import { LandingCapabilitySection } from "./landing-capability-section";
import { LandingClosingSection } from "./landing-closing-section";
import { LandingDemoSection } from "./landing-demo-section";
import { scrollToLandingFaq } from "./landing-faq-navigation";
import { LandingFaqSection } from "./landing-faq-section";
import { landingHeroMessages } from "./landing-hero-messages";
import { LandingHeroSection } from "./landing-hero-section";
import { LandingReviewSection } from "./landing-review-section";
import "./landing-theme.css";
import "./landing-header-theme.css";
import "./landing-tokens.css";

/** 组合 Lycobo 双语官网首页的功能介绍、常见问题和公共页脚。 */
export function LandingPage() {
  const t = useMessages(landingHeroMessages);
  const { hash } = useAppLocation();

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useLayoutEffect(() => {
    if (hash === "#faq") scrollToLandingFaq();
  }, [hash]);

  return (
    <>
      <div
        className="lp-page"
        onLoadCapture={(event) => {
          if (event.target instanceof HTMLImageElement) event.target.dataset.loaded = "";
        }}
      >
        <LandingHeroSection />
        <LandingCapabilitySection />
        <LandingDemoSection />
        <LandingReviewSection />
        <LandingClosingSection />
        <LandingFaqSection />
      </div>
      <SiteFooter />
    </>
  );
}
