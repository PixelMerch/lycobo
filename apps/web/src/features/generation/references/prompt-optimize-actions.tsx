import { Button, Spinner, Tooltip } from "@heroui/react";
import { IconArrowBackUp, IconWand } from "@tabler/icons-react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { promptOptimizeCredits } from "./prompt-optimizer-client";
import type { usePromptOptimizer } from "./use-prompt-optimizer";

export function PromptOptimizeActions({
  optimizer,
}: {
  optimizer: ReturnType<typeof usePromptOptimizer>;
}) {
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
            aria-label={`AI 优化提示词，消耗 ${promptOptimizeCredits} 积分`}
            isDisabled={!optimizer.canStart}
            onPress={optimizer.start}
          >
            <UiIcon icon={IconWand} size="small" />
            优化
            <span className="prompt-optimize-cost">
              <CreditCoin size="small" />
              {promptOptimizeCredits}
            </span>
          </Button>
          <Tooltip.Content placement="top">让 AI 把描述写得更详细，写完还能修改</Tooltip.Content>
        </Tooltip>
      )}
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
