import type { walletEntriesSchema } from "@lycoboai/contracts";

export type WalletEntry = ReturnType<typeof walletEntriesSchema.parse>["data"][number];

export const entryNames: Record<WalletEntry["kind"], string> = {
  opening: "期初余额",
  consume: "图片生成",
  refund: "生成失败退款",
  recharge: "充值到账",
  checkin: "签到奖励",
};
export const orderStatuses = { pending: "待支付", paid: "已到账", closed: "已关闭" } as const;
const roleNames: Record<string, string> = { member: "成员", admin: "管理员", owner: "拥有者" };
export const roleLabel = (role: string) => roleNames[role] ?? role;
const channelNames: Record<string, string> = {
  manual: "人工充值",
  wechat: "微信支付",
  alipay: "支付宝",
};

/** 会员状态尚未接入、会员也还不能购买，所有账号都按免费版展示；接入后改为读取服务端会员等级。 */
export const currentPlanName = "免费版";

export const formatCredits = (value: number) => value.toLocaleString("zh-CN");
export const signedCredits = (amount: number) =>
  `${amount > 0 ? "+" : ""}${amount.toLocaleString("zh-CN")}`;
/** 积分使用明细里的变动额：符号与数字之间留一个空格，例如“- 35”“+ 100”。 */
export function usageAmount(amount: number) {
  if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"} ${Math.abs(amount).toLocaleString("zh-CN")}`;
}
/** Whole images the credits cover at the current price; never rounds a partial image up. */
export const imagesFor = (credits: number, unitCredits: number) =>
  unitCredits > 0 ? Math.floor(credits / unitCredits) : 0;
export const channelName = (channel: string) => channelNames[channel] ?? channel;

/** "我" for the signed-in member, the UID for teammates, and 系统 for unattributed entries. */
export function memberLabel(uid: string | null, currentUid: string | undefined) {
  if (!uid) return "系统";
  return uid === currentUid ? "我" : `UID ${uid}`;
}

export function entryDetail(entry: WalletEntry) {
  if (entry.task_id) return `任务 ${entry.task_id}`;
  if (!entry.job_id && !entry.item_id && (entry.kind === "consume" || entry.kind === "refund"))
    return "提示词优化";
  if (entry.recharge_id) return `充值订单 ${entry.recharge_id.slice(0, 8).toUpperCase()}`;
  return "—";
}

const day = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const clock = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const monthDay = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
const fullDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** 积分使用明细的完整本地时间，格式为“2026.11.05 18:19”。 */
export function usageTime(iso: string) {
  const date = new Date(iso);
  const day = `${date.getFullYear()}.${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())}`;
  return `${day} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** 积分使用明细的标题：没有生成任务的消耗与退还来自提示词优化，其余按收支类型命名。 */
export function usageTitle(entry: WalletEntry) {
  if (entryDetail(entry) !== "提示词优化") return entryNames[entry.kind];
  return entry.kind === "consume" ? "提示词优化" : "提示词优化退还";
}

/** Ledger time with a relative day label, so loaded records read in order without totals. */
export function recordTime(iso: string, now = new Date()) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = clock.format(date);
  if (day(date) === day(now)) return `今天 ${time}`;
  if (day(date) === day(yesterday)) return `昨天 ${time}`;
  return `${(date.getFullYear() === now.getFullYear() ? monthDay : fullDate).format(date)} ${time}`;
}
