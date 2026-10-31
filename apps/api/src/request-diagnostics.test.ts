import { describe, expect, it } from "vitest";
import { errorCategory, safeRequestPath } from "./request-diagnostics";

describe("safe request diagnostics", () => {
  it("keeps actionable categories without exception details", () => {
    expect(
      errorCategory({
        name: "PostgresError",
        code: "53300",
        message: "private SQL",
        detail: "password",
      }),
    ).toEqual({ name: "PostgresError", errorCode: "53300" });
    expect(errorCategory({ name: "private-name", code: "private-code" })).toEqual({
      name: "Error",
    });
    expect(errorCategory(null)).toEqual({ name: "Error" });
  });
  it("redacts dynamic paths and all query parameters", () => {
    expect(
      safeRequestPath(
        new Request("https://example.test/api/v1/image-assets/private-key/content?token=secret"),
      ),
    ).toBe("/api/v1/image-assets/:id/content");
  });
});
