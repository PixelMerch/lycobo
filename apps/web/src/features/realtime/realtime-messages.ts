import { defineMessages } from "../../i18n/messages";

/** 生成完成提醒的文案：站内提示、标签页标题、桌面通知与通知开关。 */
export const realtimeMessages = defineMessages({
  "zh-CN": {
    imageDone: "图片生成完成",
    imagesDone: (count: number) => `${count} 个图片任务已完成`,
    viewResults: "查看结果",
    titleCount: (count: number) => `（${count}）生成完成 · Lycobo`,
    noticeTitle: "Lycobo · 图片生成完成",
    noticeBody: "点击查看生成结果",
    desktop: "桌面通知",
    hintUnsupported: "当前浏览器不支持桌面通知，仍可接收标签标题和站内提醒。",
    hintDenied: "通知权限已被阻止，请在浏览器的网站设置中允许通知后再开启。",
    hintFailed: "无法保存桌面通知设置，请重试。",
  },
  en: {
    imageDone: "Image generation finished",
    imagesDone: (count) => `${count} image tasks finished`,
    viewResults: "View results",
    titleCount: (count) => `(${count}) Finished · Lycobo`,
    noticeTitle: "Lycobo · Image generation finished",
    noticeBody: "Click to see the results",
    desktop: "Desktop notifications",
    hintUnsupported:
      "This browser doesn't support desktop notifications. Tab titles and in-app alerts still work.",
    hintDenied:
      "Notifications are blocked. Allow them in the browser's site settings, then turn this on.",
    hintFailed: "Couldn't save desktop notification settings. Try again.",
  },
});
