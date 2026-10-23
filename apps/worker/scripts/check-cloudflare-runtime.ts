import assert from "node:assert/strict";
import { r2ImageStore } from "@lycoboai/storage/r2";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
  "base64",
);
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "storage",
        modules: true,
        compatibilityDate: "2026-10-23",
        script: "export default {fetch(){return new Response('fixture')}}",
        r2Buckets: { BUCKET: "fixture-images" },
        images: { binding: "IMAGES" },
      },
      {
        name: "producer",
        modules: true,
        compatibilityDate: "2026-10-23",
        script:
          "export default {async fetch(request,env){await env.QUEUE.send({version:1,itemId:'550e8400-e29b-41d4-a716-446655440000'});return new Response('queued')}}",
        queueProducers: { QUEUE: "fixture-generation" },
      },
      {
        name: "consumer",
        modules: true,
        compatibilityDate: "2026-10-23",
        script:
          "export default {async queue(batch,env){for(const message of batch.messages){await env.BUCKET.put('delivered',JSON.stringify(message.body));message.ack()}}}",
        r2Buckets: { BUCKET: "fixture-delivery" },
        queueConsumers: { "fixture-generation": { maxBatchSize: 1, maxBatchTimeout: 0 } },
      },
    ],
  }),
);
try {
  const bindings = await mf.getBindings<{ BUCKET: R2Bucket; IMAGES: ImagesBinding }>("storage");
  const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
  const store = r2ImageStore(bindings.BUCKET, bindings.IMAGES, async () => "0057849613");
  const asset = await store.put(scope, png);
  assert.equal(asset.width, 2);
  assert.match(asset.objectKey, /^0057849613\//);
  assert.ok(await bindings.BUCKET.head(asset.objectKey));
  assert.ok((await store.read(asset)).length);
  // The thumbnail must exist before the asset is exposed to browsers.
  assert.ok(await bindings.BUCKET.head(asset.objectKey.replace(/\.png$/, ".thumbnail.png")));
  assert.ok((await store.thumbnail(asset)).length);
  assert.ok(await bindings.BUCKET.head(asset.objectKey.replace(/\.png$/, ".thumbnail.png")));
  await assert.rejects(store.put(scope, Buffer.from("<svg/>")));
  await assert.rejects(store.put(scope, png.subarray(0, 24)));
  await assert.rejects(store.read({ ...asset, objectKey: "../another-user" }));
  const other = r2ImageStore(bindings.BUCKET, bindings.IMAGES, async () => "1234567890");
  const otherAsset = await other.put(scope, png);
  assert.match(otherAsset.objectKey, /^1234567890\//);
  assert.notEqual(asset.objectKey, otherAsset.objectKey);
  await store.remove(asset);
  assert.equal(await bindings.BUCKET.head(asset.objectKey), null);
  assert.ok(await bindings.BUCKET.head(otherAsset.objectKey));
  const sender = await mf.getWorker("producer");
  assert.equal((await sender.fetch("http://fixture/send")).status, 200);
  const delivery = await mf.getR2Bucket("BUCKET", "consumer");
  let object = await delivery.get("delivered");
  for (let count = 0; !object && count < 50; count++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    object = await delivery.get("delivered");
  }
  assert.ok(object);
  assert.deepEqual(JSON.parse(await object.text()), {
    version: 1,
    itemId: "550e8400-e29b-41d4-a716-446655440000",
  });
  console.info(
    "Local workerd: real Queues delivery, R2 storage, UID paths, image decode/thumbnail, invalid-image rejection and scoped deletion passed (no remote services)",
  );
} finally {
  await mf.dispose();
}

if (process.env.ALLOW_LOCAL_INTEGRATION === "true") {
  const { verifyCloudflareApi } = await import("./verify-cloudflare-api");
  await verifyCloudflareApi();
}
