import { Accordion } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { membershipFaqMessages } from "./membership-faq-messages";

/** 会员页底部的订阅与积分常见问题，可同时展开多条。 */
export function MembershipFaq() {
  const t = useMessages(membershipFaqMessages);
  return (
    <section className="membership-faq" aria-labelledby="membership-faq-heading">
      <h2 id="membership-faq-heading">{t.heading}</h2>
      <Accordion allowsMultipleExpanded>
        {t.questions.map((item) => (
          <Accordion.Item id={item.id} key={item.id}>
            <Accordion.Heading>
              <Accordion.Trigger>
                {item.title}
                <Accordion.Indicator>
                  <span>
                    <UiIcon icon={IconChevronDown} size="default" />
                  </span>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>{item.body}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </section>
  );
}
