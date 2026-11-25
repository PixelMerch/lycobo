import { Accordion } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { landingFaqMessages } from "./landing-faq-messages";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-faq-section.css";

/** 首页暗色 SaaS 常见问题区：采用圆角炭灰 Accordion 呈现创作流程与积分规则。 */
export function LandingFaqSection() {
  const faq = useMessages(landingFaqMessages);

  const items = [
    { id: "images", q: faq.faqImagesQuestion, a: faq.faqImagesAnswer },
    { id: "tools", q: faq.faqToolsQuestion, a: faq.faqToolsAnswer },
    { id: "plan", q: faq.faqPlanQuestion, a: faq.faqPlanAnswer },
    { id: "prompt", q: faq.faqPromptQuestion, a: faq.faqPromptAnswer },
    { id: "credits", q: faq.faqCreditsQuestion, a: faq.faqCreditsAnswer },
    { id: "failure", q: faq.faqFailureQuestion, a: faq.faqFailureAnswer },
  ];

  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <div className="lp-container lp-faq-inner">
        <LandingSectionHeading id="faq-title" title={faq.faqTitle} tabIndex={-1} />

        <div className="lp-faq-accordion">
          <Accordion>
            {items.map((item) => (
              <Accordion.Item id={item.id} key={item.id}>
                <Accordion.Heading>
                  <Accordion.Trigger>
                    {item.q}
                    <Accordion.Indicator>
                      <UiIcon icon={IconChevronDown} size="small" />
                    </Accordion.Indicator>
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body>{item.a}</Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
