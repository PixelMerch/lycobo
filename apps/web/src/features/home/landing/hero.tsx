import { Button, Input, TextArea } from "@heroui/react";
import {
  IconArrowUp,
  IconChevronDown,
  IconLink,
  IconPhotoPlus,
  IconPlus,
  IconSettings,
  IconShoppingBag,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { GradientWaves } from "../gradient-waves/gradient-waves";
import { HeroShowcase } from "./hero-showcase";
import { landingMessages } from "./landing-messages";

const ratios = ["9:16", "16:9", "1:1", "4:5"];

/** 首屏背景：React Bits GradientWaves；无 WebGL2 时由 CSS 渐变兜底。 */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="lp-heroGradient">
      <GradientWaves />
    </div>
  );
}

/** 复刻页首屏：标语、画面比例/产品详情弹层与右侧示例；暂不提交真实生成任务。 */
export function Hero() {
  const t = useMessages(landingMessages).hero;
  const [prompt, setPrompt] = useState("");
  const [techniqueVisible, setTechniqueVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [ratio, setRatio] = useState("9:16");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onRemix = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: { title?: unknown; description?: unknown } = event.detail;
      if (typeof detail.title !== "string" || typeof detail.description !== "string") return;
      setPrompt(t.remixPrompt(detail.title, detail.description));
      setTechniqueVisible(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => promptRef.current?.focus(), 650);
    };
    const onFocusComposer = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => promptRef.current?.focus(), 650);
    };
    window.addEventListener("lp:remix", onRemix);
    window.addEventListener("lp:focus-composer", onFocusComposer);
    return () => {
      window.removeEventListener("lp:remix", onRemix);
      window.removeEventListener("lp:focus-composer", onFocusComposer);
    };
  }, [t]);

  return (
    <section aria-labelledby="campaign-hero-title" className="lp-hero" id="top">
      <HeroBackdrop />
      <div className="lp-heroInner">
        <div className="lp-heroCopy">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="lp-heroGlyph"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            <img alt="" src="/landing/glyph.svg" />
          </motion.div>
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

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="lp-heroPrompt"
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="lp-composerHost" data-expanded="true" data-guide-active="true">
              <section className="lp-composer">
                <span aria-hidden="true" className="cn-gradient-border" />
                <div className="lp-composerInputRow">
                  <div className="lp-addReference">
                    <Button isIconOnly aria-label={t.addMedia} className="cn-button">
                      <IconPlus size={20} />
                    </Button>
                  </div>

                  <div className="lp-promptEditor">
                    <div className="lp-promptField">
                      <div className="lp-promptChips">
                        {techniqueVisible && (
                          <span className="lp-techniqueChip">
                            {t.videoChip}
                            <Button
                              isIconOnly
                              aria-label={t.removeChip}
                              onPress={() => setTechniqueVisible(false)}
                            >
                              <IconX size={10} />
                            </Button>
                          </span>
                        )}
                      </div>
                      <TextArea
                        aria-label={t.describe}
                        className="lp-promptTextarea"
                        placeholder={t.placeholder}
                        ref={promptRef}
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="lp-composerToolbar">
                  <div className="lp-composerOptions">
                    <Button className="cn-button" onPress={() => setProductOpen((value) => !value)}>
                      <IconShoppingBag size={16} />
                      <span>{t.product}</span>
                    </Button>
                    <Button
                      aria-expanded={settingsOpen}
                      aria-label={t.settings}
                      className="cn-button"
                      onPress={() => setSettingsOpen((value) => !value)}
                    >
                      <span>
                        <IconSettings size={16} />
                        <span>{t.settings}</span>
                      </span>
                      <IconChevronDown
                        size={16}
                        style={{ transform: settingsOpen ? "rotate(180deg)" : undefined }}
                      />
                    </Button>
                  </div>
                  <div className="lp-composerActions">
                    <Button isIconOnly aria-label={t.create} className="cn-button">
                      <IconArrowUp size={18} />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="lp-composerPopover"
                      exit={{ opacity: 0, y: 6 }}
                      initial={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <b>{t.ratio}</b>
                      <div className="lp-ratioRow">
                        {ratios.map((item) => (
                          <Button
                            className={ratio === item ? "is-active" : ""}
                            key={item}
                            onPress={() => setRatio(item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                      <small>{t.ratioHint(ratio)}</small>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {productOpen && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="lp-composerPopover lp-productPopover"
                      exit={{ opacity: 0, y: 6 }}
                      initial={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <b>{t.product}</b>
                      <div className="lp-productField">
                        <IconLink size={14} />
                        <Input
                          aria-label={t.linkPlaceholder}
                          className="lp-productInput"
                          placeholder={t.linkPlaceholder}
                        />
                      </div>
                      <Button className="lp-ghostAction">
                        <IconPhotoPlus size={14} />
                        {t.uploadProduct}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </motion.div>
        </div>

        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={{ opacity: 0, x: 24 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <HeroShowcase />
        </motion.div>
      </div>
    </section>
  );
}
