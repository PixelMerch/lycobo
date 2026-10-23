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
