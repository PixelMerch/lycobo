import { z } from "zod";

export const businessCodes = {
  VALIDATION_ERROR: 10001,
  INVALID_REQUEST: 10002,
  PAYLOAD_TOO_LARGE: 10003,
  INVALID_IMAGE: 10004,
  REFERENCE_NOT_FOUND: 10005,
  MODEL_CAPABILITY_UNVERIFIED: 10006,
  UNAUTHORIZED: 20001,
  INVALID_CREDENTIALS: 20002,
  FORBIDDEN: 20003,
  UNTRUSTED_ORIGIN: 20004,
  RATE_LIMITED: 20005,
  NOT_FOUND: 30001,
  IDEMPOTENCY_CONFLICT: 30002,
  INSUFFICIENT_CREDITS: 30003,
  STATE_CONFLICT: 30004,
  GENERATION_NOT_CONFIGURED: 40001,
  AUTH_NOT_CONFIGURED: 40002,
  VIDEO_REFERENCES_UNAVAILABLE: 40003,
  INTERNAL_ERROR: 50000,
} as const;
const base = { request_id: z.uuid(), message: z.string() };
export const apiErrorSchema = z.object({
  ...base,
  code: z.number().int().positive(),
  data: z.strictObject({}),
  error: z.object({ code: z.string() }),
});
export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({
    ...base,
    code: z.literal(0),
    message: z.literal("成功"),
    data,
    error: z.strictObject({}),
  });
}
export const apiResponseSchema = z.union([apiSuccessSchema(z.unknown()), apiErrorSchema]);
/** Temporary rolling-upgrade support: old responses still pass through domain validation. */
export function unwrapApiData(input: unknown): unknown {
  if (typeof input !== "object" || input === null || !("request_id" in input)) return input;
  const response = apiResponseSchema.parse(input);
  if (response.code !== 0) throw new Error(response.message);
  return response.data;
}
