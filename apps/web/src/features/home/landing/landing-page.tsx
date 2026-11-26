import { useEffect, useLayoutEffect } from "react";
import { shellMessages } from "../../../app/shell-messages";
import { initializePageScrollbar } from "../../../components/page-scrollbar";
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
import { scrollToLandingPricing } from "./landing-pricing-navigation";
import { LandingPricingSection } from "./landing-pricing-section";
import { LandingReviewSection } from "./landing-review-section";
import "../../../components/page-scrollbar.css";
import { useLandingFooterReveal } from "./use-landing-footer-reveal";
import "./landing-footer-reveal.css";
import "./landing-theme.css";
import "./landing-header-theme.css";
import "./landing-tokens.css";

/** 组合首页内容与公共页脚，并复用工作区的浮动页面滚动条。 */
export function LandingPage() {
  const t = useMessages(landingHeroMessages);
  const { pageScroll } = useMessages(shellMessages);
  const { hash } = useAppLocation();
  const footerRef = useLandingFooterReveal();

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useLayoutEffect(() => initializePageScrollbar(undefined, pageScroll), [pageScroll]);

  useLayoutEffect(() => {
    if (hash === "#faq") scrollToLandingFaq();
    if (hash === "#pricing") scrollToLandingPricing();
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
        <LandingPricingSection />
        <LandingFaqSection />
      </div>
      <div className="lp-footer-reveal" ref={footerRef}>
        <SiteFooter />
      </div>
    </>
  );
}
