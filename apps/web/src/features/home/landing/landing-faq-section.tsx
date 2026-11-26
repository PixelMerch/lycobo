import { Accordion } from "@heroui/react";
import { IconArrowUpRight, IconMinus, IconPlus } from "@tabler/icons-react";
import { shellMessages } from "../../../app/shell-messages";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { creationGuidePath } from "../../guide/creation-guide-path";
import { legalPaths } from "../../legal/legal-document";
import { landingFaqMessages } from "./landing-faq-messages";
import { landingPricingPath } from "./landing-pricing-navigation";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-faq-section.css";

/** 首页常见问题与创作指南入口，使用 HeroUI 管理展开状态并链接相关政策。 */
export function LandingFaqSection() {
  const faq = useMessages(landingFaqMessages);
  const { creationHelp } = useMessages(shellMessages);

  const items = [
    { id: "tools", q: faq.faqToolsQuestion, a: faq.faqToolsAnswer },
    { id: "images", q: faq.faqImagesQuestion, a: faq.faqImagesAnswer },
    { id: "plan", q: faq.faqPlanQuestion, a: faq.faqPlanAnswer },
    { id: "credits", q: faq.faqCreditsQuestion, a: faq.faqCreditsAnswer },
    {
      id: "recharge",
      q: faq.faqRechargeQuestion,
      a: faq.faqRechargeAnswer,
      link: { to: landingPricingPath, label: faq.pricingLink },
    },
    {
      id: "failure",
      q: faq.faqFailureQuestion,
      a: faq.faqFailureAnswer,
      link: { to: legalPaths.refunds, label: faq.refundLink },
    },
    {
      id: "privacy",
      q: faq.faqPrivacyQuestion,
      a: faq.faqPrivacyAnswer,
      link: { to: legalPaths.privacy, label: faq.privacyLink },
    },
  ];

  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <div className="lp-container lp-faq-inner">
        <div className="lp-faq-intro">
          <LandingSectionHeading
            id="faq-title"
            className="lp-faq-heading"
            title={faq.faqTitle}
            tabIndex={-1}
          />
          <RouteLink to={creationGuidePath} className="lp-faq-guide">
            {creationHelp}
            <UiIcon icon={IconArrowUpRight} size="small" />
          </RouteLink>
        </div>

        <Accordion className="lp-faq-accordion" hideSeparator>
          {items.map((item) => (
            <Accordion.Item id={item.id} key={item.id}>
              <Accordion.Heading>
                <Accordion.Trigger>
                  {item.q}
                  <span className="lp-faq-indicator" aria-hidden="true">
                    <UiIcon icon={IconPlus} size="small" className="lp-faq-icon-expand" />
                    <UiIcon icon={IconMinus} size="small" className="lp-faq-icon-collapse" />
                  </span>
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  {item.a}
                  {item.link && (
                    <RouteLink className="lp-faq-answer-link" to={item.link.to}>
                      {item.link.label}
                    </RouteLink>
                  )}
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
