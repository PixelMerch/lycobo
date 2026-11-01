import { QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { queryClient } from "./query-client";

afterEach(() => queryClient.clear());

it("keeps idle stale queries quiet on focus and reconnect but refreshes explicit invalidation", async () => {
  const queryFn = vi.fn(async () => ({ balance: 42 }));
  const observer = new QueryObserver(queryClient, {
    queryKey: ["wallet"],
    queryFn,
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    queryFn.mockClear();
    const query = queryClient.getQueryCache().find({ queryKey: ["wallet"] });
    query?.onFocus();
    query?.onOnline();
    await Promise.resolve();
    expect(queryFn).not.toHaveBeenCalled();
    await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    expect(queryFn).toHaveBeenCalledOnce();
  } finally {
    unsubscribe();
  }
});

it("still reloads stale data when the user re-enters a page", async () => {
  queryClient.setQueryData(["image-tasks"], { data: [] }, { updatedAt: 1 });
  const queryFn = vi.fn(async () => ({ data: [] }));
  const observer = new QueryObserver(queryClient, { queryKey: ["image-tasks"], queryFn });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledOnce());
  } finally {
    unsubscribe();
  }
});
