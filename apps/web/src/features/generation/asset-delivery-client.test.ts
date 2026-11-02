import { afterEach, expect, it } from "vitest";
import { queryClient } from "../../lib/query-client";
import { assetContentUrl, rememberImageDeliveries } from "./asset-delivery-client";

afterEach(() => queryClient.clear());
it("keeps valid image URLs stable across metadata refreshes and replaces expiring links", () => {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const delivery = (expires_at: number, origin = "https://assets.example.test") => ({
    expires_at,
    url: `${origin}/${id}.png?expires=${expires_at}&sig=fixture`,
    thumbnail_url: `${origin}/${id}.thumbnail.png?expires=${expires_at}&sig=fixture`,
    download_url: `${origin}/${id}.png?expires=${expires_at}&sig=fixture&variant=download`,
  });
  const original = delivery(now + 1800);
  rememberImageDeliveries({ data: [{ id, delivery: original }] });
  rememberImageDeliveries({ data: [{ id, delivery: delivery(now + 1801) }] });
  expect(assetContentUrl(id)).toBe(original.url);
  expect(assetContentUrl(id, true)).toBe(original.thumbnail_url);
  const moved = delivery(now + 1800, "https://new-assets.example.test");
  rememberImageDeliveries({ id, delivery: moved });
  expect(assetContentUrl(id)).toBe(moved.url);
  queryClient.clear();
  rememberImageDeliveries({ id, delivery: delivery(now + 10) });
  rememberImageDeliveries({ id, delivery: original });
  expect(assetContentUrl(id)).toBe(original.url);
});

it("replaces a cached legacy original link when metadata supplies a preview variant", () => {
  const id = crypto.randomUUID();
  const legacy = {
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    url: `https://assets.example.test/${id}.png?sig=fixture`,
    thumbnail_url: `https://assets.example.test/${id}.png?variant=thumbnail`,
    download_url: `https://assets.example.test/${id}.png?variant=download`,
  };
  rememberImageDeliveries({ id, delivery: legacy });
  const preview = { ...legacy, url: `${legacy.url}&variant=preview` };
  rememberImageDeliveries({ id, delivery: preview });
  expect(assetContentUrl(id)).toBe(preview.url);
  expect(assetContentUrl(id, false, true)).toBe(preview.download_url);
});

it("preserves original download semantics when a link is missing or expired", () => {
  const id = crypto.randomUUID();
  expect(assetContentUrl(id, false, true)).toBe(`/api/v1/image-assets/${id}/content?download=1`);
  rememberImageDeliveries({
    id,
    delivery: {
      url: "https://assets.example.test/preview",
      thumbnail_url: "https://assets.example.test/thumb",
      download_url: "https://assets.example.test/original",
      expires_at: 1,
    },
  });
  expect(assetContentUrl(id, false, true)).toBe(`/api/v1/image-assets/${id}/content?download=1`);
});
