import { Button } from "@heroui/react";
import { IconCopy } from "@tabler/icons-react";
import { useMessages } from "../i18n/messages";
import { copyToClipboard } from "../lib/clipboard";
import { componentsMessages } from "./components-messages";
import { UiIcon } from "./ui-icon";

/** 复制完整提示词并通过共用的剪贴板提示反馈结果。 */
export function CopyPromptButton({
  text,
  label,
  className = "",
  canCopy,
}: {
  text: string;
  label?: string | undefined;
  className?: string;
  canCopy?: () => boolean;
}) {
  const t = useMessages(componentsMessages);
  return (
    <Button
      variant="secondary"
      className={className}
      onPress={() => {
        if (canCopy && !canCopy()) return;
        void copyToClipboard(text);
      }}
    >
      <UiIcon icon={IconCopy} size="small" />
      {label ?? t.copyPrompt}
    </Button>
  );
}
