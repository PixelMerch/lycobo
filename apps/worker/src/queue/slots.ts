/** Runs at most `limit` tasks at once; waiting callers start in arrival order. */
export function slots(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>) => {
    // A finishing task hands its slot to the next waiter, so newcomers cannot overtake it.
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
