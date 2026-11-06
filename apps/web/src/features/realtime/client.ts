import { notificationListSchema, releaseResponseSchema } from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { imageRequest, useImageSession } from "../generation/generation-client";
import { refreshWithoutRealtime } from "./availability";

/** 发布内容与推送共用缓存，首次读取一次，不设置定时刷新。 */
export function useSiteRelease() {
  return useQuery({
    queryKey: ["site-release"],
    staleTime: Infinity,
    retry: false,
    queryFn: async () =>
      releaseResponseSchema.parse(await (await imageRequest("realtime/release")).json()),
  });
}
/** 消息列表持久化在服务端，推送只触发按需更新。 */
export function useNotifications() {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["notifications", session.data?.organizationId, session.data?.userId],
    enabled: session.isSuccess,
    staleTime: Infinity,
    retry: false,
    initialPageParam: "",
    queryFn: async ({ pageParam }) =>
      notificationListSchema.parse(
        await (
          await imageRequest(`notifications${pageParam ? `?before=${pageParam}` : ""}`)
        ).json(),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
/** 单条已读幂等保存，同账号其他标签页经推送同步。 */
export function useReadNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => imageRequest(`notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      refreshWithoutRealtime(client, "notifications");
    },
  });
}
