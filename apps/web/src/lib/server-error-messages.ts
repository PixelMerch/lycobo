import { defineMessages } from "../i18n/messages";

/**
 * 服务端错误代码对应的英文说明。服务端只返回中文原文，英文界面按错误代码换成这里的说明；
 * 中文版不使用这些条目，保留为同一结构以便对照。
 */
export const serverErrorMessages = defineMessages({
  "zh-CN": {
    fallback: "服务暂时不可用，请稍后重试。",
    codes: {
      VALIDATION_ERROR: "填写的内容不符合要求，请检查后重试。",
      INVALID_REQUEST: "请求内容无效，请检查后重试。",
      PAYLOAD_TOO_LARGE: "请求内容过大。",
      INVALID_IMAGE: "图片格式或尺寸无效，仅支持 PNG、JPEG、WebP。",
      REFERENCE_NOT_FOUND: "参考图片不存在或不属于当前账号。",
      MODEL_CAPABILITY_UNVERIFIED: "该模型的能力尚未核实，请换一个模型。",
      UNAUTHORIZED: "登录已过期，请重新登录。",
      INVALID_CREDENTIALS: "账号或密码错误。",
      FORBIDDEN: "没有访问权限。",
      UNTRUSTED_ORIGIN: "请求来源不受信任，请刷新页面后重试。",
      RATE_LIMITED: "操作过于频繁，请稍后重试。",
      NOT_FOUND: "内容不存在或已被删除。",
      IDEMPOTENCY_CONFLICT: "这次提交与之前的提交冲突，请刷新后再提交。",
      INSUFFICIENT_CREDITS: "企业积分余额不足。",
      STATE_CONFLICT: "内容已发生变化，请刷新后重试。",
      GENERATION_NOT_CONFIGURED: "生成服务暂未开放。",
      AUTH_NOT_CONFIGURED: "登录服务暂不可用，请稍后重试。",
      VIDEO_REFERENCES_UNAVAILABLE: "视频参考图暂不可用。",
      PLANNER_REJECTED: "规划服务拒绝了这次请求，请调整描述后重试。",
      INTERNAL_ERROR: "服务暂时不可用，请稍后重试。",
    },
  },
  en: {
    fallback: "The service is unavailable right now. Please try again later.",
    codes: {
      VALIDATION_ERROR: "Some of the information isn't valid. Please check it and try again.",
      INVALID_REQUEST: "The request isn't valid. Please check it and try again.",
      PAYLOAD_TOO_LARGE: "The request is too large.",
      INVALID_IMAGE: "The image format or size isn't supported. Use PNG, JPEG or WebP.",
      REFERENCE_NOT_FOUND: "A reference image no longer exists or isn't in this account.",
      MODEL_CAPABILITY_UNVERIFIED:
        "This model hasn't been verified yet. Please choose another one.",
      UNAUTHORIZED: "Your session has expired. Please sign in again.",
      INVALID_CREDENTIALS: "The account or password is incorrect.",
      FORBIDDEN: "You don't have access to this.",
      UNTRUSTED_ORIGIN: "The request came from an untrusted page. Refresh and try again.",
      RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
      NOT_FOUND: "This item doesn't exist or was deleted.",
      IDEMPOTENCY_CONFLICT:
        "This submission conflicts with an earlier one. Refresh before submitting again.",
      INSUFFICIENT_CREDITS: "Not enough team credits.",
      STATE_CONFLICT: "This item changed in the meantime. Refresh and try again.",
      GENERATION_NOT_CONFIGURED: "Generation isn't available yet.",
      AUTH_NOT_CONFIGURED: "Sign-in is unavailable right now. Please try again later.",
      VIDEO_REFERENCES_UNAVAILABLE: "Video reference images aren't available right now.",
      PLANNER_REJECTED: "The planner declined this request. Adjust the description and try again.",
      INTERNAL_ERROR: "The service is unavailable right now. Please try again later.",
    },
  },
});
