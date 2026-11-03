import { Button, EmptyState } from "@heroui/react";
import { IconChevronRight, IconMovie } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { LibraryDialog } from "../assets/library-dialog";

/** No video tasks exist yet: show the shared empty state instead of querying image history. */
export function VideoHistory() {
  return (
    <EmptyState className="empty-state generation-empty-state">
      <UiIcon icon={IconMovie} size="illustration" />
      <p>生成的视频会显示在这里</p>
    </EmptyState>
  );
}

/** The right rail keeps the “我的素材” entry; video has no task index to list yet. */
export function VideoHistoryRail() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  return (
    <>
      <aside className="history-rail" aria-label="视频历史索引">
        <h2 className="history-rail-title">
          <Button
            variant="tertiary"
            className="history-rail-open"
            aria-label="打开素材库"
            onPress={() => setLibraryOpen(true)}
          >
            <span>我的素材</span>
            <UiIcon icon={IconChevronRight} size="small" />
          </Button>
        </h2>
        <div className="history-rail-list" />
      </aside>
      {libraryOpen && <LibraryDialog onClose={() => setLibraryOpen(false)} />}
    </>
  );
}
