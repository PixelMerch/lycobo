import type { ImageJob } from "@lycoboai/contracts";
import { IconSparkles } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { generationMessages } from "./generation-messages";

/** 返回把任务状态换成当前语言名称的函数，例如 running 显示为“生成中”。 */
export function useStatusLabel() {
  const statuses = useMessages(generationMessages).statuses;
  return (status: ImageJob["status"]) => statuses[status];
}

/** 生成中的占位图标。 */
export function GenerationLoading() {
  return (
    <div className="generation-loading-icon">
      <UiIcon icon={IconSparkles} size="illustration" />
    </div>
  );
}
