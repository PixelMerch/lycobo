import { Button } from "@heroui/react";
import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode, Ref } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { assetsMessages } from "../../assets/assets-messages";

/** 图片和视频历史共用固定标题、素材库入口和滚动容器。 */
export function HistoryRail({
  label,
  onOpenLibrary,
  listRef,
  children,
}: {
  label: string;
  onOpenLibrary: () => void;
  listRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const t = useMessages(assetsMessages);
  return (
    <aside className="history-rail" aria-label={label}>
      <h2 className="history-rail-title">
        <Button
          variant="tertiary"
          className="history-rail-open"
          aria-label={t.openLibrary}
          onPress={onOpenLibrary}
        >
          <span>{t.myAssets}</span>
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </h2>
      <div className="history-rail-list" ref={listRef}>
        {children}
      </div>
    </aside>
  );
}
