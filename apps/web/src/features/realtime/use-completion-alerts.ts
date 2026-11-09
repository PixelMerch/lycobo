import { toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { currentMessages } from "../../i18n/messages";
import { createCompletionAlerts } from "./completion-alerts";
import { observeCompletedJobs } from "./completion-observer";
import { realtimeMessages } from "./realtime-messages";

/** 在应用壳维持提醒生命周期，查看结果只导航历史，不恢复或清空草稿。 */
export function useCompletionAlerts(userId?: string, organizationId?: string) {
  const navigate = useNavigate();
  const client = useQueryClient();
  useEffect(() => {
    if (!userId || !organizationId) return;
    const toastIds = new Set<string>();
    const controller = createCompletionAlerts({
      scope: `${organizationId}:${userId}`,
      userId,
      organizationId,
      open: (result) => {
        void navigate(result.path);
      },
      notify: (results, open) => {
        const t = currentMessages(realtimeMessages);
        const title = results.length > 1 ? t.imagesDone(results.length) : t.imageDone;
        const id = toast.success(title, {
          timeout: 10000,
          actionProps: {
            children: t.viewResults,
            onPress: () => {
              toast.close(id);
              open();
            },
          },
        });
        toastIds.add(id);
        if (toastIds.size > 100) {
          const oldest = toastIds.values().next().value;
          if (oldest) toastIds.delete(oldest);
        }
      },
    });
    const unsubscribe = observeCompletedJobs(client, (job, previous) => {
      void controller.receive(job, previous).catch(() => undefined);
    });
    return () => {
      unsubscribe();
      controller.stop();
      for (const id of toastIds) toast.close(id);
    };
  }, [client, navigate, userId, organizationId]);
}
