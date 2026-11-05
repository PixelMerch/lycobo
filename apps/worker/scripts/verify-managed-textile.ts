import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { normalizeTextileGeneration, sealProviderKey } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { type ImageProcessorDependencies, processImageItem } from "../src/image-processor";

export async function verifyManagedTextile(
  store: ImageStore,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  png: Buffer,
  repository: ImageRepository,
  provider: { id: string },
  key: string,
  secret: string,
  deps: ImageProcessorDependencies,
  sql: postgres.Sql,
) {
  const reference = await store.put(owner, png);
  await repository.addReference(owner, reference);
  const textile = normalizeTextileGeneration(
    imageGenerationInputSchema.parse({
      model: "gpt-image-2.5",
      prompt: "fixture",
      count: 2,
      referenceAssetIds: [reference.id],
      textileSet: { version: 5, views: ["front", "pillow"] },
    }),
  );
  await assert.rejects(
    repository.create(owner, textile, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
  await repository.models.saveProvider(
    owner.userId,
    provider.id,
    {
      name: "Restored provider",
      origin: "https://provider.example.com",
      adapter: "fluxport-images",
      enabled: true,
    },
    await sealProviderKey(key, secret),
  );
  const textileChannel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Textile v5",
    providerId: provider.id,
    model: "gpt-image-2.5",
    upstreamModel: "gpt-image-2.5",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 1800,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "textile-set",
    model: "gpt-image-2.5",
    channelId: textileChannel.id,
  });
  const textileKey = crypto.randomUUID();
  const textileJob = await repository.create(owner, textile, textileKey);
  assert.equal((await repository.create(owner, textile, textileKey)).replayed, true);
  assert.equal((await repository.wallet(owner)).balance, 200 - 3 * imageUnitCredits);
  const textileItems = (await repository.get(owner, textileJob.id))?.items ?? [];
  let textilePosts = 0,
    textilePolls = 0;
  const textileRequest: typeof fetch = async (url, init) => {
    if (init?.method === "POST") {
      textilePosts++;
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.model, "gpt-image-2.5");
      assert.equal(payload.n, 1);
      assert.equal(payload.async, true);
      assert.equal(payload.images.length, 1);
      assert(String(url).endsWith("/v1/images/edits"));
      return Response.json(
        {
          task_id: `textile-${textilePosts}`,
          status: "running",
          status_url: `/v1/images/tasks/textile-${textilePosts}?view=summary`,
          poll_after_ms: 2000,
        },
        { status: 202, headers: { "x-request-id": `fixture-submit-${textilePosts}` } },
      );
    }
    textilePolls++;
    return Response.json({
      status: "success",
      auto_poll: false,
      data: [],
      assets: [{ b64_json: png.toString("base64") }],
    });
  };
  for (const item of textileItems) {
    const id = String(item.id);
    await processImageItem(id, { ...deps, request: textileRequest });
    await processImageItem(id, { ...deps, request: textileRequest });
  }
  assert.equal(textilePosts, 2);
  assert.equal(textilePolls, 0);
  for (const item of textileItems) {
    const id = String(item.id);
    await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${id}`;
    await processImageItem(id, { ...deps, request: textileRequest });
    await processImageItem(id, { ...deps, request: textileRequest });
  }
  assert.equal(textilePosts, 2);
  assert.equal(textilePolls, 2);
  assert.equal((await repository.get(owner, textileJob.id))?.status, "succeeded");
  assert.equal((await repository.wallet(owner)).balance, 200 - 3 * imageUnitCredits);
  const traced =
    await sql`select provider,provider_request_id from generation_job_items where job_id=${textileJob.id}`;
  assert(
    traced.every(
      (item) =>
        item.provider === "fluxport-images" &&
        String(item.provider_request_id).startsWith("fixture-submit-"),
    ),
  );
  return textileChannel;
}
