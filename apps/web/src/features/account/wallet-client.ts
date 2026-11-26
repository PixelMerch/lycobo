import {
  checkoutOptionsSchema,
  creditCheckoutSchema,
  rechargeOrdersSchema,
  walletBalanceSchema,
  walletHistorySchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { imageRequest, useImageSession } from "../generation/generation-client";

/** 查询工作区和当前用户的两个积分余额。 */
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

/** 读取合并后的积分收支，按视图和批量大小独立缓存。 */
export function useWalletEntries(pageSize = 20, view?: WalletEntryView) {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: [
      "wallet-entries",
      session.data?.organizationId,
      session.data?.userId,
      pageSize,
      view,
    ],
    enabled: session.isSuccess,
    retry: false,
    staleTime: 30000,
    initialPageParam: "",
    queryFn: async ({ signal, pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (view) params.set("view", view);
      if (pageParam) params.set("before", pageParam);
      const response = await imageRequest(`wallet/history?${params}`, { signal });
      return walletHistorySchema.parse(await response.json());
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
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
export function useCheckoutOptions(enabled = true) {
  const session = useImageSession(enabled);
  return useQuery({
    queryKey: ["checkout-options", session.data?.organizationId, session.data?.userId],
    enabled: enabled && session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      checkoutOptionsSchema.parse(await (await imageRequest("wallet/checkout", { signal })).json()),
  });
}

/** 创建托管收银台并跳转，网络异常时保持当前积分弹框。 */
export function useCreditCheckout() {
  const submitting = useRef(false);
  const checkout = useMutation({
    mutationFn: async (pack: string) => {
      const response = await imageRequest("wallet/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack, key: crypto.randomUUID() }),
      });
      return creditCheckoutSchema.parse(await response.json());
    },
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => {
      submitting.current = false;
    },
  });
  const { reset } = checkout;
  useEffect(() => {
    const restoreCheckout = (event: PageTransitionEvent) => {
      // 从收银台返回缓存的页面时，恢复购买按钮并清除上一次状态。
      if (!event.persisted) return;
      submitting.current = false;
      reset();
    };
    window.addEventListener("pageshow", restoreCheckout);
    return () => window.removeEventListener("pageshow", restoreCheckout);
  }, [reset]);
  return {
    error: checkout.error,
    variables: checkout.variables,
    isOpening: checkout.isPending || checkout.isSuccess,
    buy(pack: string) {
      // 在按钮加载态渲染前拦住连点，整次请求只创建一个收银台。
      if (submitting.current) return;
      submitting.current = true;
      checkout.mutate(pack);
    },
  };
}
