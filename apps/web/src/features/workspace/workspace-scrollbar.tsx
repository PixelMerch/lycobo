import { useLayoutEffect } from "react";
import { initializePageScrollbar } from "../../components/page-scrollbar";
import "../../components/page-scrollbar.css";
import { useMessages } from "../../i18n/messages";
import { workspaceToolMessages } from "./workspace-tool-messages";

/** 用共享的浮动滚动条控制工作区页面，保留键盘滚动入口。 */
export function WorkspaceScrollbar() {
  const { pageScroll } = useMessages(workspaceToolMessages);
  useLayoutEffect(() => initializePageScrollbar(undefined, pageScroll), [pageScroll]);
  return null;
}
