import { motion } from "motion/react";
import { impactStats } from "./content";

/** 复刻页 Campaign impact 拼贴：悬停展开由 CSS 控制，滚动视差保留 motion。 */
export function Impact() {
  return (
    <div data-campaign-reveal="">
      <section className="lp-impact">
        <div className="lp-collage">
          <div className="lp-impactMock">
            <img alt="Product campaign on mobile" src="/landing/mock.png" />
          </div>
          <div className="lp-impactSelfie">
            <img alt="Creator video example" src="/landing/imp-selfie.webp" />
            <i>
              <img alt="" src="/landing/play.svg" />
            </i>
          </div>
          <div className="lp-impactTweet">
            <img alt="Product social post" src="/landing/imp-tweet.webp" />
          </div>
          <div className="lp-impactPoster">
            <img alt="Sportswear campaign poster" src="/landing/imp-poster.webp" />
          </div>
        </div>

        <div className="lp-impactCopy">
          <span className="cn-badge lp-impactEyebrow">Campaign impact</span>
          <h2>Create More, Test Faster</h2>
          <p>
            Turn every winning insight into more creative tests — with less time between idea,
            launch and learning.
          </p>
          <dl className="lp-impactStats">
            {impactStats.map((stat, index) => (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                key={stat.label}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.08 }}
                viewport={{ once: true, margin: "-80px" }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <i>
                  <img alt="" src={stat.icon} />
                </i>
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
