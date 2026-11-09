import { expect, it } from "vitest";
import { processDiagnostic } from "./processor";

it("rejects malformed jobs instead of acknowledging them", () => {
  expect(() => processDiagnostic("healthcheck", { runId: "invalid" })).toThrow();
  expect(() => processDiagnostic("generate-image", { runId: crypto.randomUUID() })).toThrow();
});
it("acknowledges only a valid diagnostic job", () => {
  const runId = crypto.randomUUID();
  expect(processDiagnostic("healthcheck", { runId })).toEqual({ runId, status: "ok" });
});
