import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  videoCreateSchema,
  videoInputSchema,
  videoTaskSchema,
} from "@lycoboai/contracts";
import { type ImageRepository, videoCredentialHash, videoRepository } from "@lycoboai/db";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import type postgres from "postgres";
import { z } from "zod";
import { processVideoIntent } from "../src/video-processor";
/** Real isolated PostgreSQL; all provider requests and object writes below are explicit fixtures. */
export async function verifyVideos(images: ImageRepository, sql: postgres.Sql) {
  const videos = videoRepository(async (operation, args = {}) => {
    const [row] =
      await sql`select public.lycobo_video_operation(${operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args))))}) value`;
    return row?.value;
  });
  const owner = await images.provision(`video:${crypto.randomUUID()}`, "video", 1000);
  const stranger = await images.provision(`video:${crypto.randomUUID()}`, "video other", 0);
  const config = {
    origin: "https://api.uselg.top",
    key: "fixture-key",
    assetOrigin: "https://assets.fixture.test",
    signingSecret: "x".repeat(40),
  };
  const routing = { origin: config.origin, credentialHash: videoCredentialHash(config.key) };
  const input = videoInputSchema.parse({ prompt: "床品镜头缓慢推进", seconds: 18 });
  const key = crypto.randomUUID();
  const results = await Promise.all([
    videos.create(owner, input, key, routing),
    videos.create(owner, input, key, routing),
  ]);
  assert.equal(results[0]?.id, results[1]?.id);
  assert.equal(results.filter((v) => !v.replayed).length, 1);
  assert.equal((await images.wallet(owner)).balance, 900);
  await assert.rejects(
    videos.create(owner, { ...input, seconds: 15 }, key, routing),
    /IDEMPOTENCY_CONFLICT/,
  );
  await assert.rejects(
    videos.create(stranger, input, crypto.randomUUID(), routing),
    /INSUFFICIENT_CREDITS/,
  );
  assert.deepEqual(await videos.get(stranger, results[0]?.id ?? ""), []);
  const id = results[0]?.id;
  if (!id) throw new Error("fixture id");
  const claim = z.object({ token: z.string() }).parse(await videos.run("claim"));
  await videos.run("finish", {
    id,
    token: claim.token,
    status: "failed",
    errorCode: "VIDEO_PROVIDER_FAILED",
  });
  await videos.run("finish", {
    id,
    token: claim.token,
    status: "failed",
    errorCode: "VIDEO_PROVIDER_FAILED",
  });
  assert.equal((await images.wallet(owner)).balance, 1000, "Duplicate failure refunds once");
  const uncertain = await videos.create(owner, input, crypto.randomUUID(), routing);
  await videos.run("claim");
  await sql`update generation_video_outbox set lease_until=now()-interval '1 second' where job_id=${uncertain.id}`;
  await videos.run("claim");
  const uncertainTask = z
    .array(z.object({ status: z.string() }))
    .parse(await videos.get(owner, uncertain.id));
  assert.equal(uncertainTask[0]?.status, "needs_reconciliation");
  assert.equal((await images.wallet(owner)).balance, 900);
  const foreignId = crypto.randomUUID();
  await images.addReference(stranger, {
    id: foreignId,
    objectKey: `${stranger.uid}/${stranger.organizationId}/${foreignId}.png`,
    mimeType: "image/png",
    width: 2,
    height: 2,
    bytes: 10,
    sha256: "0".repeat(64),
  });
  await assert.rejects(
    videos.create(
      owner,
      { ...input, referenceAssetIds: [foreignId] },
      crypto.randomUUID(),
      routing,
    ),
    /REFERENCE_NOT_FOUND/,
  );
  assert.equal((await images.wallet(owner)).balance, 900, "Rejected references never charge");
  const referenceAssetIds = [crypto.randomUUID(), crypto.randomUUID()];
  for (const id of referenceAssetIds) {
    await images.addReference(owner, {
      id,
      objectKey: `${owner.uid}/${owner.organizationId}/${id}.png`,
      mimeType: "image/png",
      width: 2,
      height: 2,
      bytes: 10,
      sha256: id.replace(/-/g, "").repeat(2),
    });
  }
  const storyboard = { description: "一条床品视频" };
  const storyInput = videoCreateSchema.parse({ ...input, referenceAssetIds, storyboard });
  const storyboardKey = crypto.randomUUID();
  const accepted = await videos.create(owner, storyInput, storyboardKey, routing);
  assert.equal((await videos.create(owner, storyInput, storyboardKey, routing)).replayed, true);
  await assert.rejects(
    videos.create(
      owner,
      { ...storyInput, storyboard: { description: "另一段原始描述" } },
      storyboardKey,
      routing,
    ),
    /IDEMPOTENCY_CONFLICT/,
  );
  const memory = new Map<string, Uint8Array>();
  const bucket: ImageObjectBucket = {
    head: async () => null,
    get: async () => null,
    delete: async () => {},
    put: async (key, bytes) => {
      memory.set(key, bytes);
    },
  };
  const box = (type: string, bytes: Uint8Array) => {
    const value = new Uint8Array(bytes.length + 8);
    new DataView(value.buffer).setUint32(0, value.length);
    value.set(new TextEncoder().encode(type), 4);
    value.set(bytes, 8);
    return value;
  };
  const tkhd = new Uint8Array(84);
  new DataView(tkhd.buffer).setUint32(76, 512 * 65536);
  new DataView(tkhd.buffer).setUint32(80, 768 * 65536);
  const parts = [
    box("ftyp", new TextEncoder().encode("isom0000")),
    box("moov", box("trak", box("tkhd", tkhd))),
    box("mdat", new Uint8Array([1, 2, 3, 4])),
  ];
  const mp4 = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    mp4.set(part, offset);
    offset += part.length;
  }
  const methods: string[] = [];
  const request: typeof fetch = async (url, init) => {
    methods.push(init?.method ?? "GET");
    if (init?.method === "POST") {
      const body = z
        .object({ prompt: z.string(), images: z.array(z.string()) })
        .passthrough()
        .parse(JSON.parse(String(init.body)));
      assert.equal(body.prompt, input.prompt);
      assert.equal(body.images.length, 2);
      assert.ok(!("storyboard" in body));
    }
    return String(url).endsWith("/content")
      ? new Response(mp4, { headers: { "Content-Type": "video/mp4" } })
      : Response.json({
          id: "fixture-video",
          status: init?.method === "POST" ? "queued" : "completed",
          video_available: true,
        });
  };
  await processVideoIntent(videos, bucket, config, request);
  await sql`update generation_video_outbox set next_run_at=now() where job_id=${accepted.id}`;
  // Image timeout sweeps must leave long-running video tasks alone.
  await sql`update generation_job_items set started_at=now()-interval '10 minutes' where job_id=${accepted.id}`;
  await images.expireClaims();
  assert.equal(
    z.array(z.object({ status: z.string() })).parse(await videos.get(owner, accepted.id))[0]
      ?.status,
    "running",
  );
  await processVideoIntent(videos, bucket, config, request);
  assert.deepEqual(methods, ["POST", "GET", "GET"]);
  assert.equal(memory.size, 1);
  const final = videoTaskSchema.array().parse(await videos.get(owner, accepted.id));
  assert.equal(final[0]?.status, "succeeded");
  assert.deepEqual(final[0]?.input, {
    video: { ...input, referenceAssetIds },
    storyboard,
  });
  assert.equal((await images.wallet(owner)).balance, 800);
  assert.equal(
    (await images.list(owner, 100)).some((j) => j.id === accepted.id),
    false,
  );
  const library = await images.listAssets(owner, 100, undefined, "output", "video", {
    tool: "video",
    includeVideo: true,
  });
  assert.equal(library.length, 1);
  assert.equal(
    (await images.listAssets(owner, 100, undefined, "output")).some(
      (asset) => asset.type === "video",
    ),
    false,
    "Legacy clients do not receive video DTOs without opting in",
  );
  assert.equal(library[0]?.type, "video");
  assert.equal(library[0]?.duration_seconds, 18);
  assert.equal(library[0]?.resolution, "768p");
  const [intent] =
    await sql`select item_id from generation_video_outbox where job_id=${accepted.id}`;
  const videoItem = z.object({ item_id: z.string() }).parse(intent).item_id;
  await assert.rejects(images.resumeProvider(owner, accepted.id, videoItem), /NOT_FOUND/);
  await assert.rejects(images.reconcile(owner, accepted.id, videoItem, "fixture"), /NOT_FOUND/);
  const videoAsset = final[0]?.asset_id;
  if (!videoAsset) throw new Error("Missing video fixture asset");
  await assert.rejects(
    images.create(
      owner,
      imageGenerationInputSchema.parse({
        model: "gpt-image-2",
        prompt: "不能把视频当图片参考",
        referenceAssetIds: [videoAsset],
      }),
      crypto.randomUUID(),
    ),
    /REFERENCE_NOT_FOUND/,
  );
  assert.equal(
    await images.asset(owner, videoAsset),
    null,
    "Video metadata must not masquerade as StoredImage",
  );
  const { count } = z
    .object({ count: z.string() })
    .parse(
      (
        await sql`select count(*)::text count from wallet_entries where job_id=${accepted.id} and kind='consume'`
      )[0],
    );
  assert.equal(count, "1");
}
