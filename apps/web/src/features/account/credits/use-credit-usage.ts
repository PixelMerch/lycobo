import { useEffect, useState } from "react";
import type { WalletEntry } from "../account-format";
import { useWalletEntries } from "../wallet-client";

/** 积分使用明细的两个视图：已消耗只含扣费记录，充值、退款、签到与期初都算已获得。 */
export type UsageView = "spent" | "earned";

const rowsPerPage = 10;
// 服务端每批最多返回 100 条；一次翻页最多续读 5 批，稀疏的类型不会一口气读完全部历史。
const entriesPerRequest = 100;
const requestsPerTurn = 5;

/** 判断一条收支属于哪个视图。 */
export function usageViewOf(entry: WalletEntry): UsageView {
  return entry.kind === "consume" ? "spent" : "earned";
}

/** 分页条上的一项：页码，或当前页之前／之后的省略号。 */
export type PageItem = number | "start-gap" | "end-gap";

/** 页码按钮：首页、末页和当前页前后各一页，其余用省略号代替。 */
export function pageWindow(page: number, pageCount: number): PageItem[] {
  const pages = [1, page - 1, page, page + 1, pageCount].filter(
    (value, index, all) => value >= 1 && value <= pageCount && all.indexOf(value) === index,
  );
  pages.sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (const value of pages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && value - previous > 1)
      items.push(value <= page ? "start-gap" : "end-gap");
    items.push(value);
  }
  return items;
}

/**
 * 积分使用明细分页：在已读取的收支里按视图筛选，每页 10 条。
 * 当前页不满且服务端还有更早记录时继续读取，每次翻页最多续读 5 批，用完后由用户决定是否继续。
 */
export function useCreditUsage(view: UsageView) {
  const entries = useWalletEntries(entriesPerRequest);
  const [requestedPage, setRequestedPage] = useState(1);
  // 本次翻页开始时已读取的批数，用来计算这次翻页已经续读了几批。
  const [turnStart, setTurnStart] = useState(0);
  const batches = entries.data?.pages ?? [];
  const matching = batches
    .flatMap((batch) => batch.data)
    .filter((entry) => usageViewOf(entry) === view);
  const loadedPages = Math.max(1, Math.ceil(matching.length / rowsPerPage));
  const hasOlder = entries.hasNextPage;
  // 服务端没有更早记录时，页码不超过已读取的最后一页。
  const page = hasOlder ? requestedPage : Math.min(requestedPage, loadedPages);
  const rows = matching.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const pageIncomplete = rows.length < rowsPerPage && hasOlder;
  const turnSpent = batches.length - turnStart >= requestsPerTurn;
  const shouldLoad =
    pageIncomplete && !turnSpent && !entries.isFetching && !entries.isFetchNextPageError;
  const { fetchNextPage, refetch } = entries;
  useEffect(() => {
    if (shouldLoad) void fetchNextPage({ cancelRefetch: false });
  }, [shouldLoad, fetchNextPage]);
  function goTo(next: number) {
    setTurnStart(batches.length);
    setRequestedPage(Math.max(1, next));
  }
  return {
    rows,
    page,
    pageCount: Math.max(loadedPages, page),
    canNext: page < loadedPages || hasOlder,
    isLoading: entries.isPending || (pageIncomplete && entries.isFetching),
    isError: entries.isError,
    /** 本次续读额度用完但还有更早记录，交给用户决定是否继续往前查。 */
    canLoadOlder: pageIncomplete && turnSpent,
    goTo,
    loadOlder: () => goTo(page),
    retry: () => {
      if (entries.isFetchNextPageError) void fetchNextPage({ cancelRefetch: false });
      else void refetch();
    },
  };
}

/** 积分使用明细一页的读取结果与翻页操作。 */
export type CreditUsage = ReturnType<typeof useCreditUsage>;
