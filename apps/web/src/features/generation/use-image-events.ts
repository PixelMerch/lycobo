import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useEnterpriseSession } from "../auth/auth-client";
import { connectRealtime } from "../realtime/connection";
import { useCompletionAlerts } from "../realtime/use-completion-alerts";

/** 在应用壳中统一同步任务、积分、站内消息与版本，正常连接不启动 API 轮询。 */
export function useImageEvents() {
  const { data: account, isPending } = useEnterpriseSession();
  const client = useQueryClient();
  const userId = account?.userId;
  const organizationId = account?.organizationId;
  useCompletionAlerts(userId, organizationId);
  useEffect(() => {
    if (isPending || typeof WebSocket === "undefined") return;
    return connectRealtime(client, !!userId && !!organizationId);
  }, [client, userId, organizationId, isPending]);
}
