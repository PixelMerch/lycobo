import { IconLayoutGrid, IconPackage, IconPhoto } from "@tabler/icons-react";
import { motion } from "motion/react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { impactImages } from "./commerce-content";
import { sectionsMessages } from "./sections-messages";

const statIcons = {
  product: IconPackage,
  images: IconPhoto,
  uses: IconLayoutGrid,
} as const;

/** 同一款通勤包的主图、场景与两处细节，替换原投放收益拼贴。 */
export function Impact() {
  const t = useMessages(sectionsMessages).impact;
  const stats = [t.stats.product, t.stats.images, t.stats.uses];
  return (
    <div data-campaign-reveal="">
      <section className="lp-impact">
        <div className="lp-collage">
          <div className="lp-impactMock">
            <img alt={t.images.hero} loading="lazy" src={impactImages.hero} />
          </div>
          <div className="lp-impactSelfie">
            <img alt={t.images.scene} loading="lazy" src={impactImages.scene} />
          </div>
          <div className="lp-impactTweet">
            <img alt={t.images.hardware} loading="lazy" src={impactImages.hardware} />
          </div>
          <div className="lp-impactPoster">
            <img alt={t.images.leather} loading="lazy" src={impactImages.leather} />
          </div>
        </div>

        <div className="lp-impactCopy">
          <span className="cn-badge lp-impactEyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
          <dl className="lp-impactStats">
            {stats.map((stat, index) => {
              const key = (["product", "images", "uses"] as const)[index] ?? "product";
              return (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  key={key}
                  transition={{ duration: 0.6, delay: 0.1 + index * 0.08 }}
                  viewport={{ once: true, margin: "-80px" }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <i aria-hidden="true">
                    <UiIcon icon={statIcons[key]} size="action" />
                  </i>
                  <dt>{stat.value}</dt>
                  <dd>{stat.label}</dd>
                </motion.div>
              );
            })}
          </dl>
        </div>
      </section>
    </div>
  );
}
