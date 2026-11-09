import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocaleStore } from "../../i18n/locale-store";
import { queryClient } from "../../lib/query-client";
import { rememberImageDeliveries } from "./asset-delivery-client";
import { prepareDownloadDeliveries, resolveDownloadDelivery } from "./download-deliveries";
import { imageRequest } from "./generation-client";

vi.mock("./generation-client", () => ({ imageRequest: vi.fn() }));
// 断言按中文文案编写，固定界面语言。
beforeEach(() => useLocaleStore.setState({ locale: "zh-CN" }));
afterEach(() => queryClient.clear());
const delivery = () => ({
  url: "https://assets.example.test/preview.webp",
  thumbnail_url: "https://assets.example.test/thumb.webp",
  download_url: "https://assets.example.test/original.png",
  expires_at: Math.floor(Date.now() / 1000) + 1800,
});
it("reuses all valid capabilities without an API call", async () => {
  const id = crypto.randomUUID(),
    data = delivery();
  rememberImageDeliveries({ id, delivery: data });
  expect(await resolveDownloadDelivery(id, new AbortController().signal)).toEqual(data);
  expect(imageRequest).not.toHaveBeenCalled();
});
it("refreshes only missing or expiring capabilities in one scoped batch", async () => {
  const valid = crypto.randomUUID(),
    expiring = crypto.randomUUID(),
    missing = crypto.randomUUID();
  rememberImageDeliveries([
    { id: valid, delivery: delivery() },
    { id: expiring, delivery: { ...delivery(), expires_at: Math.floor(Date.now() / 1000) + 10 } },
  ]);
  vi.mocked(imageRequest).mockResolvedValue(
    new Response(
      JSON.stringify({ data: [expiring, missing].map((id) => ({ id, delivery: delivery() })) }),
    ),
  );
  const signal = new AbortController().signal;
  await prepareDownloadDeliveries([valid, expiring, missing, missing], signal);
  expect(imageRequest).toHaveBeenCalledTimes(1);
  expect(imageRequest).toHaveBeenCalledWith("image-assets/deliveries", {
    method: "POST",
    body: JSON.stringify({ ids: [expiring, missing] }),
    signal,
  });
  await resolveDownloadDelivery(missing, signal);
  expect(imageRequest).toHaveBeenCalledTimes(1);
});
it("does not download when a requested object is not authorized", async () => {
  vi.mocked(imageRequest).mockResolvedValue(new Response(JSON.stringify({ data: [] })));
  await expect(
    prepareDownloadDeliveries([crypto.randomUUID()], new AbortController().signal),
  ).rejects.toThrow("图片已失效或无权下载");
});
