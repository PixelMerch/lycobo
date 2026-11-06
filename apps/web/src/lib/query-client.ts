import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // 空闲标签页恢复不会额外查询业务数据，由实时事件和显式操作校准缓存。
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: false },
  },
});
