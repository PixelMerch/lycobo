import {
  checkoutOptionsSchema,
  checkoutReturnPathSchema,
  creditCheckoutSchema,
  rechargeOrdersSchema,
  walletBalanceSchema,
  walletHistorySchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useAppLocation } from "../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "../auth/auth-client";
import { imageRequest, useImageSession } from "../generation/generation-client";
import { useAccountOverlays } from "./account-overlay-store";
import { openCheckoutWindow, watchCheckoutReturn } from "./checkout-window";

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
export function useCheckoutOptions() {
  const { data: account } = useEnterpriseSession();
  return useQuery({
    queryKey: ["checkout-options", account?.organizationId, account?.userId],
    enabled: !!account,
    retry: false,
    queryFn: async ({ signal }) =>
      checkoutOptionsSchema.parse(await (await imageRequest("wallet/checkout", { signal })).json()),
  });
}

/** 在独立窗口打开收银台，原页面继续持有草稿与上传状态。 */
export function useCreditCheckout(anchor = "") {
  const location = useAppLocation();
  const client = useQueryClient();
  const submitting = useRef(false);
  const popup = useRef<Window | null>(null);
  const activeFlow = useRef<string | null>(null);
  const checkout = useMutation({
    mutationFn: async (pack: string) => {
      const key = crypto.randomUUID();
      const returnTo = checkoutReturnPathSchema.safeParse(
        `${location.pathnameWithLocale}${anchor || (location.hash === "#pricing" ? location.hash : "")}`,
      ).data;
      const response = await imageRequest("wallet/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack, key, returnTo }),
      });
      const { url } = creditCheckoutSchema.parse(await response.json());
      return { key, url, path: location.pathnameWithLocale };
    },
    onSuccess: ({ key, url, path }) => {
      activeFlow.current = key;
      watchCheckoutReturn(key, () => {
        // 回跳只刷新余额，账单在用户打开时读取。
        void client.invalidateQueries({ queryKey: ["wallet"] }, { cancelRefetch: false });
        if (activeFlow.current !== key) return;
        activeFlow.current = null;
        popup.current?.close();
        popup.current = null;
        checkout.reset();
        const overlays = useAccountOverlays.getState();
        if (window.location.pathname === path && overlays.dialog?.startsWith("recharge"))
          overlays.close("dialog");
      });
      if (popup.current && !popup.current.closed) popup.current.location.replace(url);
    },
    onError: () => {
      popup.current?.close();
      popup.current = null;
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  return {
    error: checkout.error,
    variables: checkout.variables,
    isOpening: checkout.isPending,
    url: checkout.data?.url,
    focusCheckout() {
      if (!popup.current || popup.current.closed) return false;
      popup.current.focus();
      return true;
    },
    buy(pack: string, userInitiated = true) {
      // 在按钮加载态渲染前拦住连点，整次请求只创建一个收银台。
      if (submitting.current) return;
      submitting.current = true;
      // 用户改选档位后，旧窗口的回跳只刷新余额，不关闭新窗口。
      activeFlow.current = null;
      popup.current = userInitiated ? openCheckoutWindow() : null;
      checkout.mutate(pack);
    },
  };
}
