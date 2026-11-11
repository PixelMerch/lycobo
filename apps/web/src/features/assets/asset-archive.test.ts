import type { ImageAsset } from "@lycoboai/contracts";
import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  AssetArchiveTooLargeError,
  archiveStamp,
  assetArchiveLimit,
  createAssetArchive,
} from "./asset-archive";

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
    ).rejects.toBeInstanceOf(AssetArchiveTooLargeError);
    expect(prepare).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
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
