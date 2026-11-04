import { Button, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { useEffect, useState } from "react";
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
  const [confirmingPrompt, setConfirmingPrompt] = useState<string | null>(null);
  const [hintedPrompt, setHintedPrompt] = useState<string | null>(null);
  const [acknowledgedPrompt, setAcknowledgedPrompt] = useState<string | null>(null);
  const isConfirming = optimizer.canStart && confirmingPrompt === prompt;
  const canHint = optimizer.canStart && !optimizer.canUndo && acknowledgedPrompt !== prompt;
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
      ) : (
        <Tooltip delay={0}>
          <Button
            variant="ghost"
            size="sm"
            className="prompt-optimize-button"
            aria-label="AI 优化提示词"
            aria-haspopup="dialog"
            isDisabled={!optimizer.canStart}
            onPress={() => {
              setAcknowledgedPrompt(prompt);
              setConfirmingPrompt(prompt);
            }}
          >
            <UiIcon
              icon={IconWand}
              size="small"
              className={canHint && hintedPrompt === prompt ? "prompt-optimize-wand-hint" : ""}
            />
            优化
          </Button>
          <Tooltip.Content placement="top">让 AI 把描述写得更详细，写完还能修改</Tooltip.Content>
        </Tooltip>
      )}
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
