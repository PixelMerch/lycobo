import { Button } from "@heroui/react";
import { motion } from "motion/react";

/** 复刻页结尾行动区：按钮只把焦点带回首屏输入框。 */
export function FinalCta() {
  return (
    <div>
      <section aria-labelledby="campaign-cta-title" className="vm-finalCta" id="start">
        <div aria-hidden="true" className="vm-ctaArtwork">
          <img alt="" src="/vidmuse/cta-bg.svg" />
        </div>
        <div className="vm-ctaCopy">
          <span className="cn-badge vm-ctaEyebrow">Ready when you are</span>
          <h2 id="campaign-cta-title">Your next campaign starts with one product link.</h2>
          <p>No creative team required. Review and edit every asset before export.</p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Button
              className="vm-startButton"
              onPress={() => window.dispatchEvent(new Event("vm:focus-composer"))}
            >
              Start Creating
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
