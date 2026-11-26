import type {
  EnterpriseIdentity,
  walletBalanceSchema,
  walletHistorySchema,
} from "@lycoboai/contracts";
import type { Locale } from "../../i18n/locale";
import { accountFormatMessages } from "./account-format-messages";

export type WalletEntry = ReturnType<typeof walletHistorySchema.parse>["data"][number];
type WalletBalance = ReturnType<typeof walletBalanceSchema.parse>;

/** 展示购买和站内积分的合计，任一有余额的账本读取失败时保持未知。 */
export function totalWalletCredits(wallet: WalletBalance | undefined) {
  if (!wallet || wallet.purchasedBalance === null) return undefined;
  return wallet.balance + (wallet.purchasedBalance ?? 0);
}

/** 账户界面优先显示昵称，未填写时沿用登录账号。 */
export function accountDisplayName(account: EnterpriseIdentity) {
  return account.nickname ?? account.account;
}

/** 收支类型的名称。 */
export const entryName = (entry: WalletEntry, locale: Locale) =>
  accountFormatMessages[locale].entries[entry.kind];
/** 充值订单状态的名称。 */
export const orderStatusName = (status: "pending" | "paid" | "closed", locale: Locale) =>
  accountFormatMessages[locale].orderStatuses[status];
/** 企业角色的名称；未知角色原样显示。 */
export function roleLabel(role: string, locale: Locale) {
  const names: Record<string, string> = accountFormatMessages[locale].roles;
  return names[role] ?? role;
}
// 中文与英文的千分位写法相同，数字固定按英文格式化，不随界面语言变化。
const numberFormat = new Intl.NumberFormat("en-US");
/** 带千分位的数字，用于金额与数量。 */
export const formatNumber = (value: number) => numberFormat.format(value);
/** 积分数额，带千分位。 */
export const formatCredits = (value: number) => numberFormat.format(value);
/** 带正负号的积分变动，例如“+500”“-4”。 */
export const signedCredits = (amount: number) =>
  `${amount > 0 ? "+" : ""}${numberFormat.format(amount)}`;
/** 积分使用明细里的变动额：符号与数字之间留一个空格，例如“- 35”“+ 100”。 */
export function usageAmount(amount: number) {
  if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"} ${numberFormat.format(Math.abs(amount))}`;
}
/** 按当前单价能生成的整张图数，不足一张的部分不向上取整。 */
export const imagesFor = (credits: number, unitCredits: number) =>
  unitCredits > 0 ? Math.floor(credits / unitCredits) : 0;
/** 支付渠道的名称；未知渠道原样显示。 */
export function channelName(channel: string, locale: Locale) {
  const names: Record<string, string> = accountFormatMessages[locale].channels;
  return names[channel] ?? channel;
}

/** 收支记录的成员：自己显示“我”，同事显示 UID，没有归属的记录显示“系统”。 */
export function memberLabel(uid: string | null, currentUid: string | undefined, locale: Locale) {
  const t = accountFormatMessages[locale];
  if (!uid) return t.system;
  return uid === currentUid ? t.me : t.uid(uid);
}

/** 没有生成任务、作品或单张图片的消耗与退还来自提示词优化。 */
export function isPromptOptimization(entry: WalletEntry) {
  if (entry.task_id || entry.job_id || entry.item_id) return false;
  return entry.kind === "consume" || entry.kind === "refund";
}

/** 收支记录的来源：任务编号、提示词优化或充值订单号，都没有时显示“—”。 */
export function entryDetail(entry: WalletEntry, locale: Locale) {
  const t = accountFormatMessages[locale];
  if (entry.task_id) return t.task(entry.task_id);
  if (isPromptOptimization(entry)) return t.promptOptimization;
  if (entry.recharge_id) return t.rechargeOrder(entry.recharge_id.slice(0, 8).toUpperCase());
  return "—";
}

const day = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** 积分使用明细的完整本地时间，格式为“2026.11.05 18:19”。 */
export function usageTime(iso: string) {
  const date = new Date(iso);
  const day = `${date.getFullYear()}.${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())}`;
  return `${day} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** 积分使用明细的标题：没有生成任务的消耗与退还来自提示词优化，其余按收支类型命名。 */
export function usageTitle(entry: WalletEntry, locale: Locale) {
  const t = accountFormatMessages[locale];
  if (!isPromptOptimization(entry)) return t.entries[entry.kind];
  return entry.kind === "consume" ? t.promptOptimization : t.promptOptimizationRefund;
}

/** 账单时间：今天、昨天加时刻，更早的显示日期，按界面语言的日期写法。 */
export function recordTime(iso: string, locale: Locale, now = new Date()) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const t = accountFormatMessages[locale];
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (day(date) === day(now)) return t.today(time);
  if (day(date) === day(yesterday)) return t.yesterday(time);
  const sameYear = date.getFullYear() === now.getFullYear();
  const dateFormat = new Intl.DateTimeFormat(locale, {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "2-digit",
    day: "2-digit",
  });
  return `${dateFormat.format(date)} ${time}`;
}
