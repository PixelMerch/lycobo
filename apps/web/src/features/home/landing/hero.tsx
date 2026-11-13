import { motion } from "motion/react";
import { type RefObject, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import type { CommerceTool } from "../../commerce/commerce-tools";
import { GradientWaves } from "../gradient-waves/gradient-waves";
import { HeroPlatforms, HeroShowcase } from "./hero-showcase";
import type { HeroExampleId } from "./hero-showcase-data";
import { landingMessages } from "./landing-messages";
import { ProductUploadPanel } from "./product-upload-panel";

/** 首屏背景：React Bits GradientWaves；无 WebGL2 时由 CSS 渐变兜底。 */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="lp-heroGradient">
      <GradientWaves />
    </div>
  );
}

/** 电商专区首屏展示创作入口与平台商品图前后对比。 */
export function Hero({
  composerRef,
  tool,
}: {
  composerRef: RefObject<HTMLElement | null>;
  tool: CommerceTool;
}) {
  const t = useMessages(landingMessages).hero;
  const [example, setExample] = useState<HeroExampleId>("bedding");

  return (
    <section aria-labelledby="campaign-hero-title" className="lp-hero" id="top">
      <HeroBackdrop />
      <div className="lp-heroInner">
        <div className="lp-heroCopy">
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            id="campaign-hero-title"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          >
            {t.title}
          </motion.h1>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            {t.description}
          </motion.p>

          <HeroPlatforms active={example} onSelect={setExample} />
          <ProductUploadPanel panelRef={composerRef} tool={tool} />
        </div>

        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={{ opacity: 0, x: 24 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <HeroShowcase active={example} onSelect={setExample} />
        </motion.div>
      </div>
    </section>
  );
}
