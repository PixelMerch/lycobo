import { Spinner } from "@heroui/react";
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { type ReactNode, useLayoutEffect } from "react";

export type SubmissionPhase = "idle" | "loading" | "success";

// DesignBookmark 的原始弹簧参数，单位与 Motion 的刚度、阻尼一致。
const widthSpring = { stiffness: 300, damping: 22 };
const idleSpring = { type: "spring", stiffness: 400, damping: 30 } as const;
const spinnerSpring = { type: "spring", stiffness: 300, damping: 28 } as const;
const successSpring = { type: "spring", stiffness: 220, damping: 20 } as const;
const colorSpring = { type: "spring", stiffness: 200, damping: 30 } as const;
const checkSpring = { type: "spring", stiffness: 120, damping: 20, delay: 0.15 } as const;
const noMotion = { duration: 0 };
const insetByPhase = { idle: 0, loading: 0.5, success: 0.1 };

/** 用弹簧裁剪按钮底板，保持布局、点击区和键盘焦点位置稳定。 */
export function GenerationButtonMotion({
  phase,
  reducedMotion,
  submittingLabel,
  successLabel,
  children,
}: {
  phase: SubmissionPhase;
  reducedMotion: boolean;
  submittingLabel: string;
  successLabel: string;
  children: ReactNode;
}) {
  const inset = useSpring(reducedMotion ? 0 : insetByPhase[phase], widthSpring);
  const clipPath = useTransform(() => {
    const ratio = Math.max(0, Math.min(0.5, inset.get()));
    const edge = `max(0px, calc((100% - var(--generate-button-height)) * ${ratio}))`;
    return `inset(0 ${edge} round var(--control-pill-radius))`;
  });
  useLayoutEffect(() => {
    if (reducedMotion) inset.jump(0);
    else inset.set(insetByPhase[phase]);
  }, [inset, phase, reducedMotion]);

  const success = phase === "success";
  return (
    <motion.span className="generate-motion" aria-hidden="true" style={{ clipPath }}>
      <motion.span
        className="generate-motion-success-fill"
        initial={false}
        animate={{ opacity: success ? 1 : 0 }}
        transition={reducedMotion ? noMotion : colorSpring}
      />
      <motion.span
        className="generate-motion-content"
        initial={false}
        animate={{ opacity: phase === "idle" ? 1 : 0, y: phase === "idle" ? 0 : 14 }}
        transition={
          reducedMotion ? noMotion : { ...idleSpring, delay: phase === "idle" ? 0.12 : 0 }
        }
      >
        {children}
      </motion.span>
      <AnimatePresence initial={false}>
        {phase === "loading" && (
          <motion.span
            key="loading"
            className="generate-motion-content"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={reducedMotion ? noMotion : spinnerSpring}
          >
            {reducedMotion ? submittingLabel : <Spinner size="md" color="current" />}
          </motion.span>
        )}
        {success && (
          <motion.span
            key="success"
            className="generate-motion-content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={reducedMotion ? noMotion : successSpring}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M5 12l4 4L19 6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reducedMotion ? noMotion : checkSpring}
              />
            </svg>
            {successLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}
