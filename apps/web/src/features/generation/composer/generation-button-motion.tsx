import { Spinner } from "@heroui/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export type SubmissionPhase = "idle" | "loading" | "success";

// 沿用 DesignBookmark 的内容弹簧，反馈只改变内容透明度和对勾。
const noMotion = { duration: 0 };
const contentTransitions = {
  idle: noMotion,
  loading: { type: "spring", stiffness: 300, damping: 28 },
  success: { type: "spring", stiffness: 220, damping: 20 },
} as const;
const checkSpring = { type: "spring", stiffness: 120, damping: 20, delay: 0.15 } as const;

/** 在固定尺寸的按钮里切换操作文字、加载反馈和提交结果。 */
export function GenerationButtonMotion({
  phase,
  reducedMotion,
  successLabel,
  children,
}: {
  phase: SubmissionPhase;
  reducedMotion: boolean;
  successLabel: string;
  children: ReactNode;
}) {
  return (
    <motion.span
      key={phase}
      className="generate-motion-content"
      aria-hidden="true"
      initial={reducedMotion || phase === "idle" ? false : { opacity: 0.65 }}
      animate={{ opacity: 1 }}
      transition={reducedMotion ? noMotion : contentTransitions[phase]}
    >
      {phase === "idle" && children}
      {phase === "loading" && <Spinner size="sm" color="current" />}
      {phase === "success" && (
        <>
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
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reducedMotion ? noMotion : checkSpring}
            />
          </svg>
          {successLabel}
        </>
      )}
    </motion.span>
  );
}
