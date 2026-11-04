import { Button, Popover, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
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
  const popover = useRef<HTMLDivElement>(null);
  const [confirmingPrompt, setConfirmingPrompt] = useState<string | null>(null);
  const isConfirming = optimizer.canStart && confirmingPrompt === prompt;

  useEffect(() => {
    if (!isConfirming) return;
    const document = trigger.current?.ownerDocument;
    if (!document) return;
    // A non-modal popover closes on focus changes. Also dismiss clicks on non-focusable surfaces.
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !popover.current?.contains(event.target)
      )
        setConfirmingPrompt(null);
    };
    document.addEventListener("click", closeOnOutsideClick, true);
    return () => document.removeEventListener("click", closeOnOutsideClick, true);
  }, [isConfirming]);

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
        <Tooltip delay={0} isDisabled={isConfirming}>
          <Button
            ref={trigger}
            variant="ghost"
            size="sm"
            className="prompt-optimize-button"
            aria-label="AI 优化提示词"
            aria-haspopup="dialog"
            aria-expanded={isConfirming}
            onPress={() => setConfirmingPrompt(isConfirming ? null : prompt)}
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
      <Popover.Content
        ref={popover}
        triggerRef={trigger}
        isOpen={isConfirming}
        onOpenChange={(open) => {
          if (!open) setConfirmingPrompt(null);
        }}
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}
        isNonModal
        placement="bottom start"
        offset={12}
        className="prompt-optimize-popover"
      >
        <Popover.Dialog aria-label="AI 优化提示词" className="prompt-optimize-confirmation">
          <p>
            消耗 <strong>{promptOptimizeCredits} 积分</strong>
          </p>
          <div className="prompt-optimize-confirm-actions">
            <Button size="sm" variant="ghost" onPress={() => setConfirmingPrompt(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              onPress={() => {
                setConfirmingPrompt(null);
                if (isConfirming) optimizer.start();
              }}
            >
              确认优化
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
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
