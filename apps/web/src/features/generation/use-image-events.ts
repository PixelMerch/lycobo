import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useEnterpriseSession } from "../auth/auth-client";
import { connectRealtime } from "../realtime/connection";
import { useCompletionAlerts } from "../realtime/use-completion-alerts";
import { useImageSession } from "./generation-client";

/** 在应用壳中统一同步任务、积分、站内消息与版本，正常连接不启动 API 轮询。 */
export function useImageEvents() {
  const account = useEnterpriseSession();
  const session = useImageSession(!!account.data);
  const client = useQueryClient();
  const userId = session.data?.userId;
  const organizationId = session.data?.organizationId;
  const signedIn = !!account.data && session.isSuccess;
  useCompletionAlerts(signedIn ? userId : undefined, signedIn ? organizationId : undefined);
  useEffect(() => {
    if (typeof WebSocket === "undefined") return;
    return connectRealtime(client, signedIn && !!userId && !!organizationId);
  }, [client, userId, organizationId, signedIn]);
}
