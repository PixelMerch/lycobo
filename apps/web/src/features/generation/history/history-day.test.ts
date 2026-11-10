import { expect, it } from "vitest";
import { historyDayLabel } from "./history-day";

const zh = { today: "今天", yesterday: "昨天" };
const en = { today: "Today", yesterday: "Yesterday" };
const at = (...parts: [number, number, number, number?, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 12, parts[4] ?? 0).toISOString();

it("groups tasks by the viewer's calendar day", () => {
  const now = new Date(2026, 10, 10, 9, 30);
  expect(historyDayLabel(at(2026, 10, 10, 0, 5), now, "zh-CN", zh)).toBe("今天");
  expect(historyDayLabel(at(2026, 10, 9, 23, 59), now, "zh-CN", zh)).toBe("昨天");
  expect(historyDayLabel(at(2026, 10, 8), now, "zh-CN", zh)).toBe("11月8日");
  expect(historyDayLabel(at(2026, 10, 8), now, "en", en)).toBe("Nov 8");
});

it("adds the year for earlier years and crosses month boundaries", () => {
  const now = new Date(2026, 0, 1, 8);
  expect(historyDayLabel(at(2025, 11, 31, 22), now, "zh-CN", zh)).toBe("昨天");
  expect(historyDayLabel(at(2025, 11, 30), now, "zh-CN", zh)).toBe("2025年12月30日");
  expect(historyDayLabel(at(2025, 11, 30), now, "en", en)).toBe("Dec 30, 2025");
  expect(historyDayLabel("not a date", now, "en", en)).toBeNull();
});
