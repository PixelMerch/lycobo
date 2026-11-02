import { expect, it } from "vitest";
import {
  channelName,
  entryDetail,
  imagesFor,
  memberLabel,
  recordTime,
  signedCredits,
  type WalletEntry,
} from "./account-format";

const entry = (overrides: Partial<WalletEntry> = {}): WalletEntry => ({
  id: "1",
  user_uid: "0057849613",
  kind: "consume",
  amount: -4,
  balance_after: 636,
  job_id: null,
  task_id: null,
  item_id: null,
  recharge_id: null,
  created_at: "2026-11-02T07:52:00.000Z",
  ...overrides,
});

it("counts only whole images the balance covers", () => {
  expect(imagesFor(636, 2)).toBe(318);
  expect(imagesFor(5, 2)).toBe(2);
  expect(imagesFor(0, 2)).toBe(0);
  expect(imagesFor(100, 0)).toBe(0);
});

it("labels members, signs amounts and keeps unknown channels honest", () => {
  expect(memberLabel("0057849613", "0057849613")).toBe("我");
  expect(memberLabel("0057849644", "0057849613")).toBe("UID 0057849644");
  expect(memberLabel(null, "0057849613")).toBe("系统");
  expect(signedCredits(500)).toBe("+500");
  expect(signedCredits(-4)).toBe("-4");
  expect(channelName("manual")).toBe("人工充值");
  expect(channelName("bank_transfer")).toBe("bank_transfer");
});

it("describes entries by their task or recharge order", () => {
  expect(entryDetail(entry({ task_id: "W26110215" }))).toBe("任务 W26110215");
  expect(
    entryDetail(entry({ kind: "recharge", recharge_id: "3f8a2c10-0000-4000-8000-000000000000" })),
  ).toBe("充值订单 3F8A2C10");
  expect(entryDetail(entry({ kind: "opening" }))).toBe("—");
});

it("prefixes ledger times with today, yesterday or the date", () => {
  const now = new Date(2026, 10, 2, 16, 0);
  expect(recordTime(new Date(2026, 10, 2, 15, 52).toISOString(), now)).toBe("今天 15:52");
  expect(recordTime(new Date(2026, 10, 1, 21, 5).toISOString(), now)).toBe("昨天 21:05");
  expect(recordTime(new Date(2026, 9, 28, 14, 10).toISOString(), now)).toBe("10/28 14:10");
  expect(recordTime(new Date(2025, 11, 31, 9, 0).toISOString(), now)).toBe("2025/12/31 09:00");
});
