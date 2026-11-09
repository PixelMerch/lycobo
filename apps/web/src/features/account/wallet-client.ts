import {
  rechargeOrdersSchema,
  walletBalanceSchema,
  walletEntriesSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { imageRequest, useImageSession } from "../generation/generation-client";
export function useWallet() {
  const session = useImageSession();
  return useQuery({
    queryKey: ["wallet", session.data?.organizationId, session.data?.userId],
    enabled: session.isSuccess,
    retry: false,
    staleTime: 10000,
    queryFn: async ({ signal }) =>
      walletBalanceSchema.parse(await (await imageRequest("wallet", { signal })).json()),
  });
}
/** 按页读取企业共享积分收支；每页条数不同的列表各自缓存，提交和任务事件按前缀一起失效。 */
export function useWalletEntries(pageSize = 20) {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["wallet-entries", session.data?.organizationId, session.data?.userId, pageSize],
    enabled: session.isSuccess,
    retry: false,
    staleTime: 30000,
    initialPageParam: "",
    queryFn: async ({ signal, pageParam }) =>
      walletEntriesSchema.parse(
        await (
          await imageRequest(
            `wallet/entries?limit=${pageSize}${pageParam ? `&before=${pageParam}` : ""}`,
            { signal },
          )
        ).json(),
      ),
    getNextPageParam: (page) => (page.data.length === pageSize ? page.data.at(-1)?.id : undefined),
  });
}
export function useRechargeOrders() {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["wallet-recharges", session.data?.organizationId, session.data?.userId],
    enabled: session.isSuccess,
    retry: false,
    initialPageParam: "",
    queryFn: async ({ signal, pageParam }) =>
      rechargeOrdersSchema.parse(
        await (
          await imageRequest(
            `wallet/recharges?limit=20${pageParam ? `&before=${pageParam}` : ""}`,
            { signal },
          )
        ).json(),
      ),
    getNextPageParam: (page) => (page.data.length === 20 ? page.data.at(-1)?.id : undefined),
  });
}
