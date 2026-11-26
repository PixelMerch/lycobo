import type { ImageAsset } from "@lycoboai/contracts";
import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { OriginalDownloadTooLargeError, type OriginalFile } from "../generation/original-download";
import { archiveStamp, assetArchiveLimit, createAssetArchive } from "./asset-archive";

const asset = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: crypto.randomUUID(),
  public_id: "P3K8Q2X01",
  task_public_id: null,
  kind: "output",
  type: "image",
  width: 1024,
  height: 1024,
  bytes: 4,
  created_at: new Date().toISOString(),
  model: "gpt-image-2.5",
  prompt: "fixture",
  ...overrides,
});

describe("asset archive", () => {
  it("packs originals in selection order with their real extensions and unchanged bytes", async () => {
    const assets = [
      asset({ public_id: "P3K8Q2X01" }),
      asset({ public_id: undefined, kind: "reference" }),
      asset({ public_id: "P3K8Q2X03", type: "video" }),
    ];
    const types = ["image/png", "image/jpeg; charset=binary", "video/mp4"];
    const prepare = vi.fn(async () => undefined);
    const read = vi.fn(async (id: string) => {
      const index = assets.findIndex((item) => item.id === id);
      return { bytes: new Uint8Array([index, 1, 2, 3]), type: types[index] ?? "" };
    });
    const zip = await createAssetArchive(assets, new AbortController().signal, read, prepare);
    const files = unzipSync(zip);
    expect(Object.keys(files)).toEqual([
      "01-P3K8Q2X01.png",
      `02-${assets[1]?.id}.jpg`,
      "03-P3K8Q2X03.mp4",
    ]);
    expect([...(files["03-P3K8Q2X03.mp4"] ?? [])]).toEqual([2, 1, 2, 3]);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("refuses a selection over the limit before downloading anything", async () => {
    const prepare = vi.fn(async () => undefined);
    const read = vi.fn();
    const assets = [asset({ bytes: assetArchiveLimit }), asset({ bytes: 1 })];
    await expect(
      createAssetArchive(assets, new AbortController().signal, read, prepare),
    ).rejects.toBeInstanceOf(OriginalDownloadTooLargeError);
    expect(prepare).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("reads only three originals at a time and reports completed files in download order", async () => {
    const assets = Array.from({ length: 5 }, () => asset({ public_id: undefined }));
    const file = { bytes: new Uint8Array([1]), type: "image/png" };
    const releases: (() => void)[] = [];
    const reads = assets.map(
      () => new Promise<OriginalFile>((resolve) => releases.push(() => resolve(file))),
    );
    const read = vi.fn((id: string) => {
      const entry = reads[assets.findIndex((item) => item.id === id)];
      if (!entry) throw new Error("Missing fixture original");
      return entry;
    });
    const onDownloaded = vi.fn();
    const result = createAssetArchive(
      assets,
      new AbortController().signal,
      read,
      async () => undefined,
      onDownloaded,
    );
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    releases[2]?.();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4));
    expect(onDownloaded).toHaveBeenCalledExactlyOnceWith(1);
    for (const release of releases) release();
    expect(Object.keys(unzipSync(await result))).toEqual(
      assets.map((item, index) => `0${index + 1}-${item.id}.png`),
    );
    expect(onDownloaded.mock.calls.flat()).toEqual([1, 2, 3, 4, 5]);
  });

  it("stops without an archive once the download is cancelled", async () => {
    const controller = new AbortController();
    const read = vi.fn(async () => {
      controller.abort();
      return { bytes: new Uint8Array([1]), type: "image/png" };
    });
    await expect(
      createAssetArchive([asset(), asset()], controller.signal, read, async () => undefined),
    ).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("names archives by local date and minute", () => {
    expect(archiveStamp(new Date(2026, 10, 10, 9, 5))).toBe("20261110-0905");
  });
});
