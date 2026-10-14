import { describe, expect, it } from "vitest";
import { createTaskSchema } from "./index";

const input = {
  projectId: "5bd71ed8-ec63-4bd5-ae8b-dcdd0da40376",
  prompt: "  泳池边的商品图  ",
  referenceAssetIds: ["41d7aaec-93e9-47f3-8884-6f8ebfb04912"],
  aspectRatio: "1:1",
  count: 4,
  idempotencyKey: "67fbf558-3ea4-47dc-b56a-632e5c691856",
};
describe("generation input boundary", () => {
  it("normalizes a valid prompt", () =>
    expect(createTaskSchema.parse(input).prompt).toBe("泳池边的商品图"));
  it.each([
    { count: 99 },
    { prompt: " " },
    { referenceAssetIds: [] },
    { ownerId: "forged" },
    { idempotencyKey: "missing" },
  ])("rejects invalid or forged fields: %j", (change) => {
    expect(createTaskSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
