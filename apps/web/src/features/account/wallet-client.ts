import {
  checkoutOptionsSchema,
  creditCheckoutSchema,
  rechargeOrdersSchema,
  type WalletSource,
  walletBalanceSchema,
  walletEntriesSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
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
/** 弹窗使用服务端的近半年消耗或获得视图。 */
export type WalletEntryView = "spent" | "earned";

/** 使用流水游标读取积分收支，按视图和批量大小独立缓存。 */
export function useWalletEntries(
  pageSize = 20,
  view?: WalletEntryView,
  source: WalletSource = "local",
) {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: [
      "wallet-entries",
      session.data?.organizationId,
      session.data?.userId,
      pageSize,
      view,
      source,
    ],
    enabled: session.isSuccess,
    retry: false,
    staleTime: 30000,
    initialPageParam: "",
    queryFn: async ({ signal, pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (view) params.set("view", view);
      if (source === "purchased") params.set("source", source);
      if (pageParam) params.set("before", pageParam);
      const response = await imageRequest(`wallet/entries?${params}`, { signal });
      return walletEntriesSchema.parse(await response.json());
    },
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

/** 按登录身份加载实际可购买的档位，商品编号留在服务端。 */
export function useCheckoutOptions() {
  const session = useImageSession();
  return useQuery({
    queryKey: ["checkout-options", session.data?.organizationId, session.data?.userId],
    enabled: session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      checkoutOptionsSchema.parse(await (await imageRequest("wallet/checkout", { signal })).json()),
  });
}

/** 创建托管收银台并跳转，网络异常时保持当前积分弹框。 */
export function useCreditCheckout() {
  return useMutation({
    mutationFn: async (pack: string) => {
      const response = await imageRequest("wallet/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack, key: crypto.randomUUID() }),
      });
      return creditCheckoutSchema.parse(await response.json());
    },
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
