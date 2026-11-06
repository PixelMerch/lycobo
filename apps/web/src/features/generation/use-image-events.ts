import { toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useEnterpriseSession } from "../auth/auth-client";
import { useSiteRelease } from "../realtime/client";
import { connectRealtime } from "../realtime/connection";
import { useImageSession } from "./generation-client";

/** 在应用壳中统一同步任务、积分、站内消息与版本，正常连接不启动 API 轮询。 */
export function useImageEvents() {
  const account = useEnterpriseSession();
  const session = useImageSession(!!account.data);
  const release = useSiteRelease().data?.release;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      !release ||
      release.version === import.meta.env.VITE_APP_RELEASE_VERSION ||
      announced.current === release.version
    )
      return;
    announced.current = release.version;
    toast.info("网站有新版本可用，可在侧栏更新记录查看；请先保存草稿再刷新。");
  }, [release]);
  const client = useQueryClient();
  const userId = session.data?.userId;
  const organizationId = session.data?.organizationId;
  const signedIn = !!account.data && session.isSuccess;
  useEffect(() => {
    if (typeof WebSocket === "undefined") return;
    return connectRealtime(client, signedIn && !!userId && !!organizationId);
  }, [client, userId, organizationId, signedIn]);
}
