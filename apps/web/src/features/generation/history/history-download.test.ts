import { imageJobSchema } from "@lycoboai/contracts";
import { unzipSync } from "fflate";
import { expect, it, vi } from "vitest";
import { createHistoryArchive, historyDownloadEntries } from "./history-download";

function job(status = "partially_failed") {
  return imageJobSchema.parse({
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "fixture",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 3,
    status,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    input: {
      model: "gpt-image-2.5",
      prompt: "fixture",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 3,
      referenceAssetIds: [crypto.randomUUID()],
      textileSet: { version: 5, views: ["front", "pillow", "fabric"] },
    },
    items: [2, 0, 1].map((position) => ({
      id: crypto.randomUUID(),
      position,
      status: position === 1 ? "failed" : "succeeded",
      output_asset_id: position === 1 ? null : crypto.randomUUID(),
      error_code: null,
      width: 480,
      height: 480,
      worker_id: null,
    })),
  });
}
it("archives only successful originals in view order without altering their bytes", async () => {
  const entries = historyDownloadEntries(job(), "zh-CN");
  expect(entries.map((entry) => entry.name)).toEqual(["01-正面.png", "03-面料特写.png"]);
  expect(historyDownloadEntries(job(), "en").map((entry) => entry.name)).toEqual([
    "01-Front.png",
    "03-Fabric close-up.png",
  ]);
  const originals = [new Uint8Array([137, 80, 78, 71, 1]), new Uint8Array([137, 80, 78, 71, 2])];
  const reader = vi.fn().mockResolvedValueOnce(originals[0]).mockResolvedValueOnce(originals[1]);
  const zipped = await createHistoryArchive(entries, reader, new AbortController().signal);
  const files = unzipSync(zipped);
  expect(Object.keys(files)).toEqual(entries.map((entry) => entry.name));
  entries.forEach((entry, index) => {
    expect(files[entry.name]).toEqual(originals[index]);
  });
  expect(reader).toHaveBeenCalledTimes(2);
});
it("does not offer bulk downloads for unfinished or single-image jobs", () => {
  expect(historyDownloadEntries(job("running"), "zh-CN")).toEqual([]);
  const single = { ...job(), requested_count: 1 };
  expect(historyDownloadEntries(single, "zh-CN")).toEqual([]);
  const pending = job();
  const first = pending.items[0];
  if (!first) throw new Error("Missing fixture item");
  first.status = "running";
  expect(historyDownloadEntries(pending, "zh-CN")).toEqual([]);
});
it("does not produce an incomplete archive after a failed or cancelled original request", async () => {
  const entries = historyDownloadEntries(job(), "zh-CN");
  const reader = vi
    .fn()
    .mockResolvedValueOnce(new Uint8Array([1]))
    .mockRejectedValueOnce(new Error("unavailable"));
  await expect(createHistoryArchive(entries, reader, new AbortController().signal)).rejects.toThrow(
    "unavailable",
  );
  const controller = new AbortController();
  controller.abort();
  const cancelled = vi.fn();
  await expect(createHistoryArchive(entries, cancelled, controller.signal)).rejects.toThrow();
  expect(cancelled).not.toHaveBeenCalled();
});
