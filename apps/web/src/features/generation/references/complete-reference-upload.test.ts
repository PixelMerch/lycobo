import { expect, it, vi } from "vitest";
import { imageRequest } from "../image-request";
import { completeReferenceUpload } from "./complete-reference-upload";

vi.mock("../image-request", () => ({
  imageRequest: vi.fn(),
  ImageApiError: class extends Error {},
}));
it("waits for persisted upload completion and returns the asset, never the ticket", async () => {
  vi.useFakeTimers();
  const id = crypto.randomUUID();
  vi.mocked(imageRequest)
    .mockResolvedValueOnce(Response.json({ status: "pending" }))
    .mockResolvedValueOnce(Response.json({ status: "succeeded", asset: { id } }));
  const completed = completeReferenceUpload(
    Response.json({ uploadId: crypto.randomUUID() }, { status: 202 }),
  );
  await vi.runAllTimersAsync();
  expect(await completed).toEqual({ id });
  vi.useRealTimers();
});
it("rejects failed processing and supports existing synchronous responses", async () => {
  vi.mocked(imageRequest).mockResolvedValueOnce(Response.json({ status: "failed" }));
  await expect(
    completeReferenceUpload(Response.json({ uploadId: crypto.randomUUID() }, { status: 202 })),
  ).rejects.toThrow("参考图处理失败");
  const id = crypto.randomUUID();
  expect(await completeReferenceUpload(Response.json({ id }, { status: 201 }))).toEqual({ id });
});
