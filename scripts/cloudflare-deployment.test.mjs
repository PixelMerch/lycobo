import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import webWorker from "../apps/api/src/cloudflare";
import imageWorker from "../apps/worker/src/cloudflare";

it("keeps background entrypoints out of the public Worker and exposes no image HTTP handler", () => {
  expect(webWorker).not.toHaveProperty("queue");
  expect(webWorker).not.toHaveProperty("scheduled");
  expect(imageWorker).not.toHaveProperty("fetch");
  expect(imageWorker.queue).toBeTypeOf("function");
  expect(imageWorker.scheduled).toBeTypeOf("function");
});

it("keeps the existing durable queue and cutover while disabling paid work in both deployments", async () => {
  const web = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const images = JSON.parse(await readFile("wrangler.images.jsonc", "utf8"));
  expect(web.queues.consumers).toBeUndefined();
  expect(web.triggers).toBeUndefined();
  expect(images.queues.consumers).toHaveLength(1);
  expect(images.queues.consumers[0].queue).toBe(web.queues.producers[0].queue);
  expect(images.queues.consumers[0].dead_letter_queue).toBe("lycobo-images-dead");
  expect(images.hyperdrive).toEqual(web.hyperdrive);
  expect(images.r2_buckets).toEqual(web.r2_buckets);
  expect(images.vars.CLOUDFLARE_TASKS_SINCE).toBe(web.vars.CLOUDFLARE_TASKS_SINCE);
  for (const config of [web, images]) {
    expect(config.vars.CLOUDFLARE_GENERATION_ENABLED).toBe("false");
    expect(config.vars.CLOUDFLARE_CONSUMER_ENABLED).toBe("true");
  }
  expect(images.workers_dev).toBe(false);
  expect(images.preview_urls).toBe(false);
  expect(images.routes).toBeUndefined();
  expect(images.assets).toBeUndefined();
  expect(images.secrets.required).not.toContain("AUTH_JWT_SECRET");
});
