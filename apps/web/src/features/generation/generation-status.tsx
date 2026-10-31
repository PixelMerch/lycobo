import type { ImageJob } from "@lycoboai/contracts";
import { IconSparkles } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";

export const statusLabel: Record<ImageJob["status"], string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "成功",
  partially_failed: "部分失败",
  failed: "失败",
  needs_reconciliation: "待确认",
};
export function GenerationLoading() {
  return (
    <div className="generation-loading-icon">
      <UiIcon icon={IconSparkles} size="illustration" />
    </div>
  );
}
