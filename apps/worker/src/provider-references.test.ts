import type { StoredImage } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { providerReferenceBytes } from "./provider-references";

const asset = (): StoredImage => ({
  id: crypto.randomUUID(),
  objectKey: "fixture.png",
  mimeType: "image/png",
  bytes: 3,
  width: 1,
  height: 1,
  sha256: "a".repeat(64),
});
it("sends a local-edit source exactly and reads other references once per instance", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const store = { read: vi.fn(async () => bytes) };
  const reference = asset();
  expect(await providerReferenceBytes(store, reference, true)).toBe(bytes);
  // Undecodable fixture bytes pass through re-encoding unchanged.
  expect(await providerReferenceBytes(store, reference, false)).toBe(bytes);
  expect(await providerReferenceBytes(store, reference, false)).toBe(bytes);
  expect(store.read).toHaveBeenCalledTimes(2);
});
it("reads a reference again after a failed storage read", async () => {
  const store = {
    read: vi
      .fn<() => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error("IMAGE_STORAGE_UNAVAILABLE"))
      .mockResolvedValue(new Uint8Array([1])),
  };
  const reference = asset();
  await expect(providerReferenceBytes(store, reference, false)).rejects.toThrow(
    "IMAGE_STORAGE_UNAVAILABLE",
  );
  expect(await providerReferenceBytes(store, reference, false)).toEqual(new Uint8Array([1]));
  expect(store.read).toHaveBeenCalledTimes(2);
});
