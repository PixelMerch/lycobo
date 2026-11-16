import { motion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { productStoryMessages } from "./product-story-messages";

/** 保持卡片节点连续，通过布局投影将素材编排为场景与多画幅套图。 */
export function ProductStoryStage({ step, instant }: { step: number; instant: boolean }) {
  const t = useMessages(productStoryMessages);
  const cards = [
    {
      id: "source",
      src: "p02-blender-hero",
      alt: t.sourceAlt,
      title: step === 3 ? t.hero : t.source,
      ratio: "1:1",
    },
    { id: "lid", src: "p02-lid", alt: t.lidAlt, title: t.lid, ratio: "1:1" },
    { id: "body", src: "p02-body", alt: t.bodyAlt, title: t.body, ratio: "1:1" },
    { id: "scene", src: "p02-motion-sage", alt: t.sageAlt, title: t.scene, ratio: "3:4" },
    { id: "portrait", src: "p02-ratio-9x16", alt: t.portraitAlt, title: t.portrait, ratio: "9:16" },
  ];
  return (
    <div className="product-story-stage" data-step={step} data-instant={instant}>
      {cards.map((card) => (
        <motion.figure
          key={card.id}
          layout={!instant}
          layoutDependency={step}
          initial={false}
          animate={{ opacity: card.id === "portrait" && step !== 3 ? 0 : 1 }}
          transition={{
            layout: { duration: instant ? 0 : 0.72, ease: [0.23, 1, 0.32, 1] },
            opacity: { duration: instant ? 0 : 0.25 },
          }}
          className={`product-story-card product-story-card--${card.id}`}
          style={{ borderRadius: 18 }}
          aria-hidden={card.id === "portrait" && step !== 3}
        >
          <div className="product-story-photo">
            <img
              src={`/landing/commerce/${card.src}.webp`}
              alt={card.alt}
              aria-hidden={card.id === "scene" && step === 2}
              loading="lazy"
            />
            {card.id === "scene" && (
              <motion.img
                className="product-story-rose"
                src="/landing/commerce/p02-motion-rose.webp"
                alt={t.roseAlt}
                aria-hidden={step !== 2}
                loading="lazy"
                initial={false}
                animate={{ opacity: step === 2 ? 1 : 0 }}
                transition={{ duration: instant ? 0 : 0.8, ease: [0.77, 0, 0.175, 1] }}
              />
            )}
          </div>
          <figcaption>
            <span>{card.title}</span>
            {step === 3 && <span className="product-story-ratio">{card.ratio}</span>}
          </figcaption>
        </motion.figure>
      ))}
      <div className="product-story-scene-label" aria-hidden={step === 0 || step === 3}>
        <span className="product-story-swatch" />
        {step === 2 ? t.rose : t.sage}
      </div>
    </div>
  );
}
