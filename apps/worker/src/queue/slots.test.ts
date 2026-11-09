import { expect, it } from "vitest";
import { slots } from "./slots";

it("never runs more image encodes than its slots, even as newcomers arrive", async () => {
  const run = slots(2);
  let active = 0,
    peak = 0;
  const order: number[] = [];
  const task = (id: number) =>
    run(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      order.push(id);
      if (id === 0) await Promise.all([task(10), task(11)]);
      return id;
    });
  expect(await Promise.all([0, 1, 2, 3].map(task))).toEqual([0, 1, 2, 3]);
  expect(peak).toBe(2);
  expect(order.slice(0, 2)).toEqual([0, 1]);
});
it("frees a slot when a task fails", async () => {
  const run = slots(1);
  await expect(run(async () => Promise.reject(new Error("encode failed")))).rejects.toThrow();
  expect(await run(async () => "next")).toBe("next");
});
