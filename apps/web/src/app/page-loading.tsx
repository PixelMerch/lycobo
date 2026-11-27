import { componentsMessages } from "../components/components-messages";
import { useMessages } from "../i18n/messages";

/** 页面布局尚未挂载时向辅助技术提供加载状态。 */
export function PageLoading() {
  const t = useMessages(componentsMessages);
  return <div className="sr-only" role="status" aria-label={t.loading} />;
}
