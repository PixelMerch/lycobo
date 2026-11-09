import { expect, it } from "vitest";
import { imageEventCursorSchema, imageEventSchema } from "./image-events";

it("rejects malformed and out-of-range cursors without throwing and validates minimal event data", () => {
  for (const value of [
    "invalid",
    "-1",
    "01",
    "1.2",
    "1e2",
    "9223372036854775808",
    "",
    "9".repeat(1000),
  ])
    expect(imageEventCursorSchema.safeParse(value).success).toBe(false);
  for (const value of ["0", "1", "9223372036854775807"])
    expect(imageEventCursorSchema.parse(value)).toBe(value);
  expect(
    imageEventSchema.safeParse({ id: "1", kind: "task", resourceId: crypto.randomUUID() }).success,
  ).toBe(true);
});
