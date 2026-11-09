import { defineMessages } from "../i18n/messages";

/** 通用工具的提示文案：复制结果与响应读取失败。 */
export const libMessages = defineMessages({
  "zh-CN": {
    copied: "复制成功",
    copyFailed: "复制失败，请手动选择复制",
    incompleteResponse: "响应未完整接收，请重试查询；已提交的任务请勿重复生成",
  },
  en: {
    copied: "Copied",
    copyFailed: "Couldn't copy. Please select the text and copy it yourself",
    incompleteResponse:
      "The response didn't arrive in full. Please check again; don't regenerate tasks you already submitted",
  },
});
