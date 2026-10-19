import { describe, expect, it } from "vitest";
import { readWorkbenchSession } from "./session";

describe("local workbench session configuration", () => {
  const token = "a".repeat(43);
  it("never enables automatic identities in production", () => {
    expect(readWorkbenchSession({ NODE_ENV: "production" })).toBeUndefined();
    expect(() =>
      readWorkbenchSession({ NODE_ENV: "production", IMAGE_WORKBENCH_TOKEN: token }),
    ).toThrow();
    expect(
      readWorkbenchSession({ NODE_ENV: "development", IMAGE_WORKBENCH_TOKEN: token })?.origins,
    ).toContain("http://localhost:8080");
  });
  it("rejects public or ambiguous trusted origins", () => {
    for (const origin of [
      "https://example.com",
      "http://localhost:8080/path",
      "http://localhost:8080@evil.example",
    ]) {
      expect(() =>
        readWorkbenchSession({
          NODE_ENV: "development",
          IMAGE_WORKBENCH_TOKEN: token,
          IMAGE_WORKBENCH_ORIGINS: origin,
        }),
      ).toThrow();
    }
  });
});
