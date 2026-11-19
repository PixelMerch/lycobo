import { Button, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { promptOptimizeCredits } from "./prompt-optimizer-client";
import { referencesMessages } from "./references-messages";
import type { usePromptOptimizer } from "./use-prompt-optimizer";

/** 提示词旁的 AI 优化操作：确认扣费、停止与撤销。 */
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
  const t = useMessages(referencesMessages);
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
      {isConfirming && (
        <fieldset aria-label={t.confirmOptimize} className="prompt-optimize-confirmation">
          <span className="prompt-optimize-price">
            {t.costBefore}
            <strong>{t.cost(promptOptimizeCredits)}</strong>
          </span>
          <div className="prompt-optimize-confirm-actions">
            <Button autoFocus size="sm" variant="ghost" onPress={cancelAndRestoreFocus}>
              {t.cancel}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onPress={() => {
                setConfirmingPrompt(null);
                optimizer.start();
              }}
            >
              {t.confirm}
            </Button>
          </div>
        </fieldset>
      )}
      {!isConfirming && optimizer.running && (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-optimize-button"
          aria-label={t.stopOptimizing}
          onPress={optimizer.stop}
        >
          <Spinner size="sm" color="current" aria-hidden="true" />
          {t.stop}
        </Button>
      )}
      {!isConfirming && !optimizer.running && optimizer.canStart && (
        <Tooltip delay={0}>
          <Button
            ref={trigger}
            variant="ghost"
            size="sm"
            className="prompt-optimize-button"
            aria-label={t.optimizePrompt}
            onPress={() => setConfirmingPrompt(prompt)}
          >
            <span className="prompt-optimize-wand">
              <UiIcon icon={IconWand} size="small" color={`url(#${gradientId})`}>
                <defs>
                  <linearGradient id={gradientId} x2="100%" y2="55%">
                    <stop stopColor="var(--prompt-optimize-ink, var(--accent))" />
                    <stop
                      offset="100%"
                      stopColor="var(--prompt-optimize-ink, var(--brand-light))"
                    />
                  </linearGradient>
                </defs>
              </UiIcon>
            </span>
            <span className="prompt-optimize-label">{t.optimize}</span>
          </Button>
          <Tooltip.Content placement="top">{t.polishPrompt}</Tooltip.Content>
        </Tooltip>
      )}
      {optimizer.canUndo && !isConfirming && (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-optimize-undo"
          aria-label={t.restorePrompt}
          onPress={optimizer.undo}
        >
          <UiIcon icon={IconArrowBackUp} size="small" />
          {t.undo}
        </Button>
      )}
    </div>
  );
}
