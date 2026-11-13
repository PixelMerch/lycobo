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
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { HeroScene } from "./hero-scene";
import { HeroShowcase } from "./hero-showcase";
import { vidmuseMessages } from "./vidmuse-messages";

const ratios = ["9:16", "16:9", "1:1", "4:5"];

/** 首屏背景：开发服务器优先挂载采集场景，其他环境使用同源循环视频兜底。 */
function HeroBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden="true" className="vm-heroGradient">
      {import.meta.env.DEV && <HeroScene />}
      <video
        autoPlay={!reduced}
        className="vm-heroBackgroundVideo"
        disablePictureInPicture
        loop
        muted
        playsInline
        poster="/vidmuse/hero-bg-poster.webp"
        preload="auto"
        tabIndex={-1}
      >
        <source src="/vidmuse/hero-bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

/** 复刻页首屏：标语、画面比例/产品详情弹层与右侧示例；暂不提交真实生成任务。 */
export function Hero() {
  const t = useMessages(vidmuseMessages).hero;
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
    window.addEventListener("vm:remix", onRemix);
    window.addEventListener("vm:focus-composer", onFocusComposer);
    return () => {
      window.removeEventListener("vm:remix", onRemix);
      window.removeEventListener("vm:focus-composer", onFocusComposer);
    };
  }, [t]);

  return (
    <section aria-labelledby="campaign-hero-title" className="vm-hero" id="top">
      <HeroBackdrop />
      <div className="vm-heroInner">
        <div className="vm-heroCopy">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="vm-heroGlyph"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            <img alt="" src="/vidmuse/glyph.svg" />
          </motion.div>
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            id="campaign-hero-title"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          >
            MAKE ADS THAT CONVERT
          </motion.h1>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            VidMuse researches what works, rebuilds the winning logic, and generates every asset
            your campaign needs.
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="vm-heroPrompt"
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="vm-composerHost" data-expanded="true" data-guide-active="true">
              <section className="vm-composer">
                <span aria-hidden="true" className="cn-gradient-border" />
                <div className="vm-composerInputRow">
                  <div className="vm-addReference">
                    <Button isIconOnly aria-label={t.addMedia} className="cn-button">
                      <IconPlus size={20} />
                    </Button>
                  </div>

                  <div className="vm-promptEditor">
                    <div className="vm-promptField">
                      <div className="vm-promptChips">
                        {techniqueVisible && (
                          <span className="vm-techniqueChip">
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
                        className="vm-promptTextarea"
                        placeholder={t.placeholder}
                        ref={promptRef}
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="vm-composerToolbar">
                  <div className="vm-composerOptions">
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
                  <div className="vm-composerActions">
                    <Button isIconOnly aria-label={t.create} className="cn-button">
                      <IconArrowUp size={18} />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="vm-composerPopover"
                      exit={{ opacity: 0, y: 6 }}
                      initial={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <b>{t.ratio}</b>
                      <div className="vm-ratioRow">
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
                      className="vm-composerPopover vm-productPopover"
                      exit={{ opacity: 0, y: 6 }}
                      initial={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <b>{t.product}</b>
                      <div className="vm-productField">
                        <IconLink size={14} />
                        <Input
                          aria-label={t.linkPlaceholder}
                          className="vm-productInput"
                          placeholder={t.linkPlaceholder}
                        />
                      </div>
                      <Button className="vm-ghostAction">
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
