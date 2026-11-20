import { Button } from "@heroui/react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMessages } from "../i18n/messages";
import { copyToClipboard } from "../lib/clipboard";
import { componentsMessages } from "./components-messages";
import { UiIcon } from "./ui-icon";

// 沿用 DesignBookmark 对文字、图标和文字可见宽度的三组弹簧。
const labelSpring = { stiffness: 260, damping: 20 };
const iconSpring = { stiffness: 420, damping: 18 };
const widthSpring = { stiffness: 300, damping: 24 };

/** 在原按钮内滚动切换复制文案和对勾，写入剪贴板成功后才播放。 */
export function CopyButton({
  text,
  label,
  className = "",
  canCopy,
}: {
  text: string;
  label: string;
  className?: string;
  canCopy?: () => boolean;
}) {
  const t = useMessages(componentsMessages);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastAttempt = useRef(0);
  const idleLabel = useRef<HTMLSpanElement>(null);
  const copiedLabel = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const labelProgress = useSpring(0, labelSpring);
  const iconProgress = useSpring(0, iconSpring);
  const width = useSpring(0, widthSpring);
  const y = useTransform(labelProgress, [0, 1], ["0%", "-50%"], { clamp: false });
  const copyOpacity = useTransform(iconProgress, [0, 0.625], [1, 0]);
  const copyScale = useTransform(iconProgress, [0, 1], [1, 0.5]);
  const copyRotate = useTransform(iconProgress, [0, 1], [0, -40]);
  const checkOpacity = useTransform(iconProgress, [0.25, 0.875], [0, 1]);
  const checkScale = useTransform(iconProgress, [-0.2, 1.2], [0.28, 1.12]);

  useLayoutEffect(() => {
    const target = copied ? 1 : 0;
    if (reducedMotion) {
      labelProgress.jump(target);
      iconProgress.jump(target);
    } else {
      labelProgress.set(target);
      iconProgress.set(target);
    }

    const row = copied ? copiedLabel.current : idleLabel.current;
    if (!row) return;
    const measure = () => {
      const nextWidth = row.offsetWidth;
      if (reducedMotion || !width.get()) width.jump(nextWidth);
      else width.set(nextWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [copied, iconProgress, labelProgress, reducedMotion, width]);

  useEffect(
    () => () => {
      lastAttempt.current += 1;
      clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy() {
    if (canCopy && !canCopy()) return;
    const attempt = ++lastAttempt.current;
    const success = await copyToClipboard(text, false);
    if (attempt !== lastAttempt.current) return;
    clearTimeout(resetTimer.current);
    setCopied(success);
    if (success) resetTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <Button
        variant="secondary"
        aria-label={label}
        data-copied={copied || undefined}
        className={className}
        onPress={() => void copy()}
      >
        <span className="copy-feedback-icon" aria-hidden="true">
          <motion.span style={{ opacity: copyOpacity, rotate: copyRotate, scale: copyScale }}>
            <UiIcon icon={IconCopy} size="small" />
          </motion.span>
          <motion.span style={{ opacity: checkOpacity, scale: checkScale }}>
            <UiIcon icon={IconCheck} size="small" className="copy-feedback-success" />
          </motion.span>
        </span>
        <span className="copy-feedback-labels" aria-hidden="true">
          <span className="copy-feedback-label-reserve">{label}</span>
          <motion.span className="copy-feedback-label-viewport" style={{ width }}>
            <motion.span className="copy-feedback-label-track" style={{ y }}>
              <span ref={idleLabel}>{label}</span>
              <span className="copy-feedback-success" ref={copiedLabel}>
                {t.copyComplete}
              </span>
            </motion.span>
          </motion.span>
        </span>
      </Button>
      <span className="sr-only" role="status">
        {copied ? t.copyComplete : ""}
      </span>
    </>
  );
}
