import { Button, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  const trigger = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [confirmingPrompt, setConfirmingPrompt] = useState<string | null>(null);
  const isConfirming = optimizer.canStart && confirmingPrompt === prompt;

  const cancelAndRestoreFocus = useCallback(() => {
    setConfirmingPrompt(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  useEffect(() => {
    if (!isConfirming) return;
    const document = actions.current?.ownerDocument;
    if (!document) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !actions.current?.contains(event.target))
        setConfirmingPrompt(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        event.target instanceof Node &&
        actions.current?.contains(event.target)
      ) {
        event.preventDefault();
        cancelAndRestoreFocus();
      }
    };
    document.addEventListener("click", closeOnOutsideClick, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isConfirming, cancelAndRestoreFocus]);

  return (
    <div ref={actions} className="prompt-optimize" data-confirming={isConfirming || undefined}>
      {isConfirming ? (
        <fieldset aria-label="确认优化提示词" className="prompt-optimize-confirmation">
          <span className="prompt-optimize-price">
            消耗 <strong>{promptOptimizeCredits} 积分</strong>
          </span>
          <div className="prompt-optimize-confirm-actions">
            <Button autoFocus size="sm" variant="ghost" onPress={cancelAndRestoreFocus}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              onPress={() => {
                setConfirmingPrompt(null);
                optimizer.start();
              }}
            >
              确认优化
            </Button>
          </div>
        </fieldset>
      ) : optimizer.running ? (
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
            ref={trigger}
            variant="ghost"
            size="sm"
            className="prompt-optimize-button"
            aria-label="AI 优化提示词"
            onPress={() => setConfirmingPrompt(prompt)}
          >
            <span className="prompt-optimize-wand">
              <UiIcon icon={IconWand} size="small" color={`url(#${gradientId})`}>
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
      {optimizer.canUndo && !isConfirming && (
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
