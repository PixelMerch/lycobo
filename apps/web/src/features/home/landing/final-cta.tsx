import { Button } from "@heroui/react";
import { motion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { sectionsMessages } from "./sections-messages";

/** 电商专区结尾入口将创作展示卡滚动到视口中央。 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const t = useMessages(sectionsMessages).cta;
  return (
    <div>
      <section aria-labelledby="campaign-cta-title" className="lp-finalCta" id="start">
        <div aria-hidden="true" className="lp-ctaArtwork">
          <img alt="" src="/landing/cta-bg.svg" />
        </div>
        <div className="lp-ctaCopy">
          <span className="cn-badge lp-ctaEyebrow">{t.eyebrow}</span>
          <h2 id="campaign-cta-title">{t.title}</h2>
          <p>{t.description}</p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Button className="lp-startButton" onPress={onStart}>
              {t.button}
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
