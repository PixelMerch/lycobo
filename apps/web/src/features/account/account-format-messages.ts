import { defineMessages } from "../../i18n/messages";

/** 账户与积分格式化使用的收支、订单、角色和支付渠道名称。 */
export const accountFormatMessages = defineMessages({
  "zh-CN": {
    entries: {
      opening: "期初余额",
      consume: "图片生成",
      refund: "生成失败退款",
      recharge: "充值到账",
      checkin: "签到奖励",
    },
    orderStatuses: { pending: "待支付", paid: "已到账", closed: "已关闭" },
    roles: { member: "成员", admin: "管理员", owner: "拥有者" },
    channels: {
      creem: "Creem",
      "creem-test": "Creem Test",
      manual: "人工充值",
      wechat: "微信支付",
      alipay: "支付宝",
    },
    system: "系统",
    me: "我",
    uid: (uid: string) => `UID ${uid}`,
    task: (id: string) => `任务 ${id}`,
    promptOptimization: "提示词优化",
    promptOptimizationRefund: "提示词优化退还",
    rechargeOrder: (id: string) => `充值订单 ${id}`,
    today: (time: string) => `今天 ${time}`,
    yesterday: (time: string) => `昨天 ${time}`,
  },
  en: {
    entries: {
      opening: "Opening balance",
      consume: "Image generation",
      refund: "Refund for failed generation",
      recharge: "Top-up received",
      checkin: "Check-in reward",
    },
    orderStatuses: { pending: "Awaiting payment", paid: "Credited", closed: "Closed" },
    roles: { member: "Member", admin: "Admin", owner: "Owner" },
    channels: {
      creem: "Creem",
      "creem-test": "Creem Test",
      manual: "Manual top-up",
      wechat: "WeChat Pay",
      alipay: "Alipay",
    },
    system: "System",
    me: "Me",
    uid: (uid) => `UID ${uid}`,
    task: (id) => `Task ${id}`,
    promptOptimization: "Prompt optimization",
    promptOptimizationRefund: "Prompt optimization refund",
    rechargeOrder: (id) => `Top-up order ${id}`,
    today: (time) => `Today ${time}`,
    yesterday: (time) => `Yesterday ${time}`,
  },
});
