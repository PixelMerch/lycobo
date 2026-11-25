import { Button } from "@heroui/react";
import { IconSparkle } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { generationMessages } from "../generation-messages";
import { GenerationButtonMotion, type SubmissionPhase } from "./generation-button-motion";
import "./generate-button.css";

const minimumLoadingMs = 240;
const successHoldMs = 2000;

/** 创作工作区的提交按钮，以请求回执驱动反馈并锁住重复点击。 */
export function GenerateButton({
  label,
  submitting,
  isDisabled,
  submittingLabel,
  successLabel,
  cost,
  costDescription,
  describedBy,
  compact = false,
  onPress,
  onSuccessFeedbackEnd,
}: {
  label: string;
  submitting: boolean;
  isDisabled: boolean;
  submittingLabel: string;
  successLabel?: string | undefined;
  cost?: number | undefined;
  costDescription?: string | undefined;
  describedBy?: string | undefined;
  compact?: boolean;
  /** 收到有效回执时返回 true；跳过提交或请求失败时恢复按钮。 */
  onPress: () => Promise<boolean>;
  onSuccessFeedbackEnd?: () => void;
}) {
  const t = useMessages(generationMessages);
  const [phase, setPhase] = useState<SubmissionPhase>("idle");
  const locked = useRef(false);
  const reducedMotion = !!useReducedMotion();
  const state = phase === "idle" && submitting ? "loading" : phase;
  const feedbackLabel = successLabel ?? t.submitted;
  const status = { idle: "", loading: submittingLabel, success: feedbackLabel }[state];
  const defaultCostDescription = cost !== undefined && !describedBy ? t.runCost(cost) : undefined;
  const finishFeedback = useEffectEvent(() => {
    locked.current = false;
    setPhase("idle");
    onSuccessFeedbackEnd?.();
  });

  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(finishFeedback, successHoldMs);
    return () => clearTimeout(timer);
  }, [phase]);

  async function submit() {
    // 同一帧里的二次点击可能早于 React 更新按钮状态，先同步上锁。
    if (locked.current || submitting || isDisabled) return;
    locked.current = true;
    setPhase("loading");
    const startedAt = performance.now();
    const accepted = await onPress().catch(() => false);
    if (!accepted) {
      locked.current = false;
      setPhase("idle");
      return;
    }
    const remaining = minimumLoadingMs - (performance.now() - startedAt);
    if (!reducedMotion && remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
    setPhase("success");
  }

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        fullWidth={!compact}
        className={`primary-action generation-submit animated-generate${compact ? " animated-generate-compact" : ""}`}
        data-submit-state={state}
        isPending={state === "loading"}
        isDisabled={state === "idle" && isDisabled}
        {...(state === "success" ? { "aria-disabled": true } : {})}
        aria-label={state === "success" ? feedbackLabel : label}
        aria-description={
          state === "idle" ? (costDescription ?? defaultCostDescription) : undefined
        }
        {...(state === "idle" && describedBy ? { "aria-describedby": describedBy } : {})}
        onPress={submit}
      >
        <GenerationButtonMotion
          phase={state}
          successLabel={feedbackLabel}
          reducedMotion={reducedMotion}
        >
          {label}
          {cost !== undefined && (
            <span className="generate-credit-cost">
              <UiIcon icon={IconSparkle} />
              <span>{cost}</span>
            </span>
          )}
        </GenerationButtonMotion>
      </Button>
      <span className="sr-only" role="status">
        {status}
      </span>
    </>
  );
}
