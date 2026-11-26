import { toast as heroToast } from "@heroui/react";
import { afterEach, expect, it, vi } from "vitest";
import { toast } from "./toast";

afterEach(() => {
  heroToast.clear();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it("queues notifications for three seconds and retains their actions", () => {
  vi.useFakeTimers();
  const action = vi.fn();
  const success = toast.success("Fixture success", {
    actionProps: { children: "View result", onPress: action },
  });
  const ids = [success, toast.info("Info"), toast.warning("Warning"), toast.danger("Error")];
  const notices = heroToast.getQueue().visibleToasts;
  expect(ids.map((id) => notices.find(({ key }) => key === id)?.timeout)).toEqual([
    3000, 3000, 3000, 3000,
  ]);
  expect(notices.find(({ key }) => key === success)?.content.actionProps?.onPress).toBe(action);
});
