import type { ReactNode } from "react";
import { initializePageScrollbar } from "../../components/page-scrollbar";
import "../../components/page-scrollbar.css";

function mountComposerScrollbar(panel: HTMLElement | null) {
  if (panel) return initializePageScrollbar(panel);
}

/** 参数区共用滚动容器，表单内容增减时同步更新浮动滚动条。 */
export function WorkspaceComposerScroll({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="composer-scroll-frame">
      <section className="composer-scroll" aria-label={label} ref={mountComposerScrollbar}>
        <div className="composer-scroll-content">{children}</div>
      </section>
    </div>
  );
}
