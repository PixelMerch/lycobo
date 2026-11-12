import { motion } from "motion/react";
import { impactStats } from "./content";

/** 复刻页 Campaign impact 拼贴：悬停展开由 CSS 控制，滚动视差保留 motion。 */
export function Impact() {
  return (
    <div>
      <section className="vm-impact">
        <div className="vm-collage">
          <div className="vm-impactMock">
            <img alt="Product campaign on mobile" src="/vidmuse/mock.png" />
          </div>
          <div className="vm-impactSelfie">
            <img alt="Creator video example" src="/vidmuse/imp-selfie.webp" />
            <i>
              <img alt="" src="/vidmuse/play.svg" />
            </i>
          </div>
          <div className="vm-impactTweet">
            <img alt="Product social post" src="/vidmuse/imp-tweet.webp" />
          </div>
          <div className="vm-impactPoster">
            <img alt="Sportswear campaign poster" src="/vidmuse/imp-poster.webp" />
          </div>
        </div>

        <div className="vm-impactCopy">
          <span className="cn-badge vm-impactEyebrow">Campaign impact</span>
          <h2>Create More, Test Faster</h2>
          <p>
            Turn every winning insight into more creative tests — with less time between idea,
            launch and learning.
          </p>
          <dl className="vm-impactStats">
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
