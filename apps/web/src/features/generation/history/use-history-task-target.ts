import { imageJobSchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useErrorToast } from "../../../lib/error-toast";
import { imageRequest, useImageSession } from "../generation-client";
import { useStudioStore } from "../studio-state";
import { historyLocaleNavigation } from "./history-locale-navigation";
import { scrollToHistoryTask } from "./history-navigation";

/** 显式定位历史任务，语言切换不重复滚动或覆盖创作草稿。 */
export function useHistoryTaskTarget(compact: boolean) {
  const [params] = useSearchParams();
  const location = useLocation();
  const session = useImageSession();
  const revealedNavigation = useRef<string | null>(null);
  const previousNavigation = useRef<ReturnType<typeof historyLocaleNavigation> | null>(null);
  const task = params.get("task");
  const id = task && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(task) ? task : null;
  const query = useQuery({
    queryKey: ["image-history-target", session.data?.organizationId, session.data?.userId, id],
    enabled: !compact && !!id && session.isSuccess,
    queryFn: async ({ signal }) =>
      imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`, { signal })).json()),
    retry: false,
  });
  useErrorToast(query.error?.message);
  useEffect(() => {
    const navigation = historyLocaleNavigation(previousNavigation.current, location);
    previousNavigation.current = navigation;
    if (compact || !query.data || revealedNavigation.current === navigation.key) return;
    const jobId = query.data.id;
    let frame = 0;
    let done = false;
    const reveal = () => {
      if (
        done ||
        document.querySelector('[role="dialog"]') ||
        !document.getElementById(`job-${jobId}`)
      )
        return;
      done = true;
      revealedNavigation.current = navigation.key;
      observer.disconnect();
      useStudioStore.getState().setActiveHistoryId(jobId);
      scrollToHistoryTask(jobId);
    };
    // 等嵌套浮层关闭并释放滚动锁后再定位任务。
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    frame = requestAnimationFrame(reveal);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [compact, query.data, location]);
  return compact ? undefined : query.data;
}
