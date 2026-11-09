import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { uploadImageReferences } from "./image-submission";

it("starts independent reference uploads together and preserves reference order", async () => {
  const client = new QueryClient();
  const pending: Array<(asset: { id: string }) => void> = [];
  vi.spyOn(client, "fetchQuery").mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const references = ["first", "second", "third"].map((id) => ({
    id,
    src: `blob:${id}`,
    name: id,
  }));
  const result = uploadImageReferences(
    client,
    { organizationId: "org", userId: "user" },
    references,
  );
  expect(pending).toHaveLength(3);
  pending[2]?.({ id: "asset-third" });
  pending[1]?.({ id: "asset-second" });
  pending[0]?.({ id: "asset-first" });
  expect(await result).toEqual(["asset-first", "asset-second", "asset-third"]);
  client.clear();
});

it("bounds upload concurrency and reuses already persisted references", async () => {
  const client = new QueryClient();
  const pending: Array<(asset: { id: string }) => void> = [];
  const fetch = vi
    .spyOn(client, "fetchQuery")
    .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const references = ["one", "two", "three", "four"].map((id) => ({
    id,
    src: `blob:${id}`,
    name: id,
  }));
  const result = uploadImageReferences(client, { organizationId: "org", userId: "user" }, [
    ...references,
    { id: "saved", assetId: "asset-saved", src: "https://fixture.example/saved", name: "saved" },
  ]);
  expect(fetch).toHaveBeenCalledTimes(3);
  for (const [index, resolve] of pending.entries()) resolve({ id: `asset-${index}` });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  pending[3]?.({ id: "asset-3" });
  expect(await result).toEqual(["asset-0", "asset-1", "asset-2", "asset-3", "asset-saved"]);
  client.clear();
});
