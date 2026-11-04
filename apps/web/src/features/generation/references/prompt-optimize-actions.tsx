import { Button, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { promptOptimizeCredits } from "./prompt-optimizer-client";
import type { usePromptOptimizer } from "./use-prompt-optimizer";

export function PromptOptimizeActions({
  optimizer,
  prompt,
}: {
  optimizer: ReturnType<typeof usePromptOptimizer>;
  prompt: string;
}) {
  const gradientId = useId();
  const [confirmingPrompt, setConfirmingPrompt] = useState<string | null>(null);
  const [hintedPrompt, setHintedPrompt] = useState<string | null>(null);
  const [acknowledgedPrompt, setAcknowledgedPrompt] = useState<string | null>(null);
  const isConfirming = optimizer.canStart && confirmingPrompt === prompt;
  const canHint = optimizer.canStart && !optimizer.canUndo && acknowledgedPrompt !== prompt;
  const showHint = canHint && hintedPrompt === prompt;
  useEffect(() => {
    if (!canHint) return;
    const timer = window.setTimeout(() => setHintedPrompt(prompt), 650);
    return () => window.clearTimeout(timer);
  }, [canHint, prompt]);

  return (
    <div className="prompt-optimize">
      {optimizer.running ? (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-optimize-button"
          aria-label="停止优化"
          onPress={optimizer.stop}
        >
          <Spinner size="sm" color="current" aria-hidden="true" />
          停止
        </Button>
      ) : optimizer.canStart ? (
        <Tooltip delay={0}>
          <Button
            variant="ghost"
            size="sm"
            className="prompt-optimize-button"
            aria-label="AI 优化提示词"
            aria-haspopup="dialog"
            onPress={() => {
              setAcknowledgedPrompt(prompt);
              setConfirmingPrompt(prompt);
            }}
          >
            <span className="prompt-optimize-wand" data-spark={showHint || undefined}>
              <UiIcon
                icon={IconWand}
                size="small"
                color={`url(#${gradientId})`}
                className={showHint ? "prompt-optimize-wand-hint" : ""}
              >
                <defs>
                  <linearGradient id={gradientId} x2="100%" y2="55%">
                    <stop stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="#54e6a5" />
                  </linearGradient>
                </defs>
              </UiIcon>
            </span>
            <span className="prompt-optimize-label">优化</span>
          </Button>
          <Tooltip.Content placement="top">AI 润色提示词</Tooltip.Content>
        </Tooltip>
      ) : null}
      <ConfirmDialog
        isOpen={isConfirming}
        title="AI 优化提示词"
        content={`本次优化将消耗 ${promptOptimizeCredits} 积分。优化完成后，你仍可以修改提示词。`}
        confirmLabel="确认优化"
        onCancel={() => setConfirmingPrompt(null)}
        onConfirm={() => {
          setConfirmingPrompt(null);
          if (isConfirming) optimizer.start();
        }}
      />
      {optimizer.canUndo && (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-optimize-undo"
          aria-label="恢复优化前的提示词"
          onPress={optimizer.undo}
        >
          <UiIcon icon={IconArrowBackUp} size="small" />
          撤销
        </Button>
      )}
    </div>
  );
}
