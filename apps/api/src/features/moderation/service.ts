const errors = {
  CONTENT_REJECTED: { status: 400, message: "提示词未通过审核，请修改后重试。" },
  MODERATION_UNAVAILABLE: { status: 503, message: "内容审核暂不可用，请稍后重试。" },
} as const;

/** 审核失败只携带固定错误码，避免暴露提示词、密钥和服务商响应。 */
export class ModerationError extends Error {
  readonly failure;

  constructor(readonly code: keyof typeof errors) {
    super(code);
    this.failure = errors[code];
  }
}

export type GenerationModerator = (
  prompts: readonly string[],
  requestId: string,
  signal: AbortSignal,
  separateApprovals?: boolean,
) => Promise<readonly string[] | undefined>;
