import { Accordion } from "@heroui/react";
import { motion } from "motion/react";
import { copyVariants, kitCovers, kitCtas, kitFeeds, kitVideos } from "./content";

const coverImages = kitCovers;

function PlayGlyph() {
  return (
    <span>
      <img alt="" src="/landing/create-play.svg" />
    </span>
  );
}

function FolderVisual() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="lp-folder"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <img alt="" src="/landing/folder-gradient.webp" />
      <div aria-hidden="true" className="lp-paperStack">
        {[0, 1, 2].map((sheet) => (
          <div key={sheet}>
            {[0, 1, 2, 3, 4].map((line) => (
              <i key={line} />
            ))}
          </div>
        ))}
      </div>
      <div className="lp-folderFront">
        <b>Social Publishing Kits</b>
        <span>One-click launch kits</span>
        <p>
          <strong>36</strong> Assets
        </p>
      </div>
    </motion.div>
  );
}

interface KitPanelProps {
  expandedKey: string;
  onExpandedChange: (key: string) => void;
}

/** 工作流第三步的 Campaign Kit 折叠列表与示例缩略图。 */
export function KitPanel({ expandedKey, onExpandedChange }: KitPanelProps) {
  return (
    <div className="lp-createKit">
      <FolderVisual />

      <div className="lp-kitRowsWrap">
        <Accordion
          className="lp-kitRows"
          expandedKeys={[expandedKey]}
          hideSeparator
          onExpandedChange={(keys) => {
            const next = Array.from(keys)[0];
            if (next !== undefined) onExpandedChange(String(next));
          }}
          variant="surface"
        >
          <Accordion.Item className="lp-kitRow" id="videos">
            <Accordion.Heading>
              <Accordion.Trigger className="lp-kitTrigger">
                <b>Videos · 9:16</b>
                <span>TikTok / Reels</span>
                <em>6</em>
                <Accordion.Indicator className="lp-kitChevron">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m12.8 6.1-4.663 4.8L3.2 6.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel className="lp-kitContent">
              <Accordion.Body className="lp-kitBody">
                <div className="lp-kitThumbnails">
                  {kitVideos.map((src) => (
                    <i key={src}>
                      <img alt="Campaign video cover" src={src} />
                      <PlayGlyph />
                    </i>
                  ))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item className="lp-kitRow" id="feed">
            <Accordion.Heading>
              <Accordion.Trigger className="lp-kitTrigger">
                <b>Feed · 4:5</b>
                <span>Meta Feed</span>
                <em>4</em>
                <Accordion.Indicator className="lp-kitChevron">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m12.8 6.1-4.663 4.8L3.2 6.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel className="lp-kitContent">
              <Accordion.Body className="lp-kitBody">
                <div className="lp-feedExamples">
                  {kitFeeds.map((src) => (
                    <i key={src}>
                      <img alt="Campaign feed creative" src={src} />
                    </i>
                  ))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item className="lp-kitRow" id="covers">
            <Accordion.Heading>
              <Accordion.Trigger className="lp-kitTrigger">
                <b>Covers · 1:1</b>
                <span>Cover Options</span>
                <em>8</em>
                <Accordion.Indicator className="lp-kitChevron">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m12.8 6.1-4.663 4.8L3.2 6.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel className="lp-kitContent">
              <Accordion.Body className="lp-kitBody">
                <div className="lp-coverExamples">
                  {coverImages.map((src) => (
                    <i key={src}>
                      <img alt="Campaign cover option" src={src} />
                    </i>
                  ))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item className="lp-kitRow" id="copy">
            <Accordion.Heading>
              <Accordion.Trigger className="lp-kitTrigger">
                <b>Copy Variants</b>
                <span>Hook + Caption + Headline</span>
                <em>12</em>
                <Accordion.Indicator className="lp-kitChevron">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m12.8 6.1-4.663 4.8L3.2 6.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel className="lp-kitContent">
              <Accordion.Body className="lp-kitBody">
                <div className="lp-copyExamples">
                  {copyVariants.map((group) => (
                    <section key={group.group}>
                      <h4>{group.group}</h4>
                      {group.items.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </section>
                  ))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item className="lp-kitRow" id="cta">
            <Accordion.Heading>
              <Accordion.Trigger className="lp-kitTrigger">
                <b>CTA Variants</b>
                <span>Meta Feed</span>
                <em>6</em>
                <Accordion.Indicator className="lp-kitChevron">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m12.8 6.1-4.663 4.8L3.2 6.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel className="lp-kitContent">
              <Accordion.Body className="lp-kitBody">
                <div className="lp-ctaExamples">
                  {kitCtas.map((src, index) => (
                    <i key={src}>
                      <img alt={`CTA variant ${index + 1}`} src={src} />
                    </i>
                  ))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>
    </div>
  );
}
