import { describe, expect, it } from "vitest";
import { apiErrorSchema, apiResponseSchema, unwrapApiData } from "./api-response";

describe("API response contract", () => {
  it("unwraps successful data and supports old servers during rolling upgrades", () => {
    const data = { userId: crypto.randomUUID() };
    expect(
      unwrapApiData({ request_id: crypto.randomUUID(), code: 0, message: "成功", data, error: {} }),
    ).toEqual(data);
    expect(unwrapApiData(data)).toEqual(data);
  });
  it("rejects invalid request IDs and surfaces a business error even on an HTTP 200", () => {
    const error = {
      request_id: crypto.randomUUID(),
      code: 20001,
      message: "请先登录",
      data: {},
      error: { code: "UNAUTHORIZED" },
    };
    expect(apiErrorSchema.safeParse(error).success).toBe(true);
    expect(() => unwrapApiData(error)).toThrow("请先登录");
    expect(apiResponseSchema.safeParse({ ...error, request_id: "forged" }).success).toBe(false);
    expect(apiResponseSchema.safeParse({ ...error, code: "20001" }).success).toBe(false);
  });
});
