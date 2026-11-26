import { expect, it } from "vitest";
import {
  channelName,
  entryDetail,
  imagesFor,
  memberLabel,
  recordTime,
  roleLabel,
  signedCredits,
  totalWalletCredits,
  usageAmount,
  usageTime,
  usageTitle,
  type WalletEntry,
} from "./account-format";

const entry = (overrides: Partial<WalletEntry> = {}): WalletEntry => ({
  id: "1",
  user_uid: "0057849613",
  kind: "consume",
  amount: -4,
  job_id: null,
  task_id: null,
  item_id: null,
  recharge_id: null,
  created_at: "2026-11-02T07:52:00.000Z",
  ...overrides,
});

it("shows a single total without treating an unread purchased balance as zero", () => {
  expect(totalWalletCredits({ balance: 391, purchasedBalance: 104, unitCredits: 2 })).toBe(495);
  expect(totalWalletCredits({ balance: 391, purchasedBalance: 0, unitCredits: 2 })).toBe(391);
  expect(totalWalletCredits({ balance: 391, unitCredits: 2 })).toBe(391);
  expect(
    totalWalletCredits({ balance: 391, purchasedBalance: null, unitCredits: 2 }),
  ).toBeUndefined();
  expect(totalWalletCredits(undefined)).toBeUndefined();
});

it("counts only whole images the balance covers", () => {
  expect(imagesFor(636, 2)).toBe(318);
  expect(imagesFor(5, 2)).toBe(2);
  expect(imagesFor(0, 2)).toBe(0);
  expect(imagesFor(100, 0)).toBe(0);
});

it("labels members, signs amounts and keeps unknown channels honest", () => {
  expect(memberLabel("0057849613", "0057849613", "zh-CN")).toBe("我");
  expect(memberLabel("0057849644", "0057849613", "zh-CN")).toBe("UID 0057849644");
  expect(memberLabel(null, "0057849613", "zh-CN")).toBe("系统");
  expect(memberLabel("0057849613", "0057849613", "en")).toBe("Me");
  expect(memberLabel(null, "0057849613", "en")).toBe("System");
  expect(signedCredits(500)).toBe("+500");
  expect(signedCredits(-4)).toBe("-4");
  expect(channelName("manual", "zh-CN")).toBe("人工充值");
  expect(channelName("alipay", "en")).toBe("Alipay");
  expect(channelName("bank_transfer", "en")).toBe("bank_transfer");
  expect(roleLabel("admin", "zh-CN")).toBe("管理员");
  expect(roleLabel("owner", "en")).toBe("Owner");
  expect(roleLabel("auditor", "en")).toBe("auditor");
});

it("describes entries by their task or recharge order", () => {
  expect(entryDetail(entry({ task_id: "W26110215" }), "zh-CN")).toBe("任务 W26110215");
  expect(
    entryDetail(
      entry({ kind: "recharge", recharge_id: "3f8a2c10-0000-4000-8000-000000000000" }),
      "zh-CN",
    ),
  ).toBe("充值订单 3F8A2C10");
  expect(entryDetail(entry({ amount: -1 }), "zh-CN")).toBe("提示词优化");
  expect(entryDetail(entry({ kind: "opening" }), "zh-CN")).toBe("—");
  expect(entryDetail(entry({ task_id: "W26110215" }), "en")).toBe("Task W26110215");
  expect(entryDetail(entry({ amount: -1 }), "en")).toBe("Prompt optimization");
});

it("prefixes ledger times with today, yesterday or the date", () => {
  const now = new Date(2026, 10, 2, 16, 0);
  const at = (...parts: [number, number, number, number, number]) =>
    new Date(...parts).toISOString();
  expect(recordTime(at(2026, 10, 2, 15, 52), "zh-CN", now)).toBe("今天 15:52");
  expect(recordTime(at(2026, 10, 1, 21, 5), "zh-CN", now)).toBe("昨天 21:05");
  expect(recordTime(at(2026, 9, 28, 14, 10), "zh-CN", now)).toBe("10/28 14:10");
  expect(recordTime(at(2025, 11, 31, 9, 0), "zh-CN", now)).toBe("2025/12/31 09:00");
  expect(recordTime(at(2026, 10, 2, 15, 52), "en", now)).toBe("Today 15:52");
  expect(recordTime(at(2026, 10, 1, 21, 5), "en", now)).toBe("Yesterday 21:05");
  expect(recordTime(at(2025, 11, 31, 9, 0), "en", now)).toBe("12/31/2025 09:00");
});

it("formats credit usage rows like the usage dialog", () => {
  expect(usageAmount(-35)).toBe("- 35");
  expect(usageAmount(1200)).toBe("+ 1,200");
  expect(usageAmount(0)).toBe("0");
  expect(usageTime(new Date(2026, 10, 5, 8, 9).toISOString())).toBe("2026.11.05 08:09");
  expect(usageTitle(entry({ task_id: "W26110215" }), "zh-CN")).toBe("图片生成");
  expect(usageTitle(entry(), "zh-CN")).toBe("提示词优化");
  expect(usageTitle(entry({ kind: "refund", amount: 1 }), "zh-CN")).toBe("提示词优化退还");
  expect(usageTitle(entry({ kind: "refund", amount: 4, task_id: "W26110215" }), "zh-CN")).toBe(
    "生成失败退款",
  );
  expect(usageTitle(entry({ kind: "recharge", amount: 500 }), "zh-CN")).toBe("充值到账");
  expect(usageTitle(entry({ kind: "refund", amount: 1 }), "en")).toBe("Prompt optimization refund");
  expect(usageTitle(entry({ kind: "recharge", amount: 500 }), "en")).toBe("Top-up received");
});
