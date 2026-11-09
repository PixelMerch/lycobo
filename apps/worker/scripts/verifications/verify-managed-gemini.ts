import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import {
  type ImageProcessorDependencies,
  processImageItem,
} from "../../src/images/image-processor";

export async function verifyGeminiModel(
  repository: ImageRepository,
  provider: { id: string },
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  sql: postgres.Sql,
  deps: ImageProcessorDependencies,
  png: Buffer,
  store: ImageStore,
) {
  const geminiOwner = await repository.provision(
    `gemini-${crypto.randomUUID()}`,
    "gemini-fixture",
    2 * imageUnitCredits,
  );
  const geminiSettings = {
    name: "Gemini fixture",
    providerId: provider.id,
    model: "gemini-3.1-flash-image-preview",
    upstreamModel: "gemini-3.1-flash-image-preview",
    adapter: "gemini-native",
    mode: "provider-default",
    enabled: true,
    editsEnabled: true,
    maxReferences: 5,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  };
  const geminiChannel = await repository.models.saveChannel(
    owner.userId,
    undefined,
    geminiSettings,
  );
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: geminiSettings.model,
    channelId: geminiChannel.id,
  });
  // Definitively failed old-protocol jobs adopt current routing only on explicit retry.
  const protocolOwner = await repository.provision(
    `protocol-retry-${crypto.randomUUID()}`,
    "protocol-fixture",
    40,
  );
  await repository.models.saveChannel(owner.userId, geminiChannel.id, {
    ...geminiSettings,
    adapter: "fluxport-images",
  });
  const protocolInput = imageGenerationInputSchema.parse({
    model: geminiSettings.model,
    prompt: "fixture",
  });
  const protocolJob = await repository.create(
    protocolOwner,
    protocolInput,
    crypto.randomUUID(),
    20,
    true,
  );
  const protocolItem = (await repository.get(protocolOwner, protocolJob.id))?.items[0];
  assert(protocolItem);
  const protocolClaim = await repository.claim(protocolItem.id, "old-protocol-fixture", 10000);
  assert(protocolClaim);
  await repository.finish(protocolClaim, { errorCode: "PROVIDER_HTTP_400", unknown: false });
  await repository.models.saveChannel(owner.userId, geminiChannel.id, geminiSettings);
  const protocolRetryKey = crypto.randomUUID();
  await repository.retry(protocolOwner, protocolJob.id, protocolRetryKey, undefined, true);
  const [retriedProtocol] =
    await sql`select provider_snapshot from generation_jobs where id=${protocolJob.id}`;
  assert.equal(
    retriedProtocol?.provider_snapshot.adapter,
    "gemini-native",
    "Explicit retry must replace obsolete protocol for fully failed jobs",
  );
  const [oldProtocolEvidence] =
    await sql`select reconciliation_evidence from generation_job_items where id=${protocolItem.id}`;
  assert.match(String(oldProtocolEvidence?.reconciliation_evidence), /fluxport-images/);
  assert.equal(
    (await repository.retry(protocolOwner, protocolJob.id, protocolRetryKey, undefined, true))
      .replayed,
    true,
  );
  assert.equal((await repository.wallet(protocolOwner)).balance, 40 - imageUnitCredits);
  const retriedProtocolItem = (await repository.get(protocolOwner, protocolJob.id))?.items[0];
  assert(retriedProtocolItem);
  await processImageItem(retriedProtocolItem.id, {
    ...deps,
    request: async (url, init) => {
      assert.equal(init?.method, "POST");
      assert.match(String(url), /:generateContent$/);
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }],
            },
          },
        ],
      });
    },
  });
  assert.equal((await repository.get(protocolOwner, protocolJob.id))?.status, "succeeded");
  await verifyNativeGeminiResults(
    store,
    geminiOwner,
    png,
    repository,
    geminiSettings,
    deps,
    owner,
    geminiChannel,
    sql,
  );
  await verifyGrokCompatibility(sql, repository, owner, geminiSettings, store, png, deps);

  await sql`delete from model_routes where channel_id=${geminiChannel.id}`;
}

async function verifyNativeGeminiResults(
  store: ImageStore,
  geminiOwner: Awaited<ReturnType<ImageRepository["provision"]>>,
  png: Buffer,
  repository: ImageRepository,
  geminiSettings: {
    name: string;
    providerId: string;
    model: string;
    upstreamModel: string;
    adapter: string;
    mode: string;
    enabled: boolean;
    editsEnabled: boolean;
    maxReferences: number;
    timeoutMs: number;
    taskTimeoutSeconds: number;
    downloadOrigins: never[];
  },
  deps: ImageProcessorDependencies,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  geminiChannel: { id: string },
  sql: postgres.Sql,
) {
  const geminiReference = await store.put(geminiOwner, png);
  await repository.addReference(geminiOwner, geminiReference);
  // Providers receive the stored (re-encoded) reference, not the uploaded bytes.
  const geminiReferenceData = Buffer.from(await store.read(geminiReference)).toString("base64");
  for (const asyncMode of [false, true]) {
    const nativeInput = imageGenerationInputSchema.parse({
      model: geminiSettings.model,
      prompt: "fixture",
      resolution: "4K",
      referenceAssetIds: [geminiReference.id],
    });
    const nativeJob = await repository.create(
      geminiOwner,
      nativeInput,
      crypto.randomUUID(),
      20,
      true,
    );
    const nativeItem = (await repository.get(geminiOwner, nativeJob.id))?.items[0];
    assert(nativeItem);
    let nativePosts = 0;
    let nativeGets = 0;
    const nativeRequest: typeof fetch = async (url, init) => {
      if (init?.method === "POST") {
        nativePosts++;
        assert(
          String(url).endsWith("/v1beta/models/gemini-3.1-flash-image-preview:generateContent"),
        );
        const payload = JSON.parse(String(init.body));
        assert.equal(payload.generationConfig.imageConfig.imageSize, "4K");
        assert.equal(payload.contents[0].parts[1].inlineData.data, geminiReferenceData);
        assert.equal(payload.n, undefined);
        if (asyncMode)
          return Response.json(
            {
              task_id: "gemini-native-fixture",
              status: "queued",
              status_url: "/v1/images/tasks/gemini-native-fixture?view=summary",
            },
            { status: 202 },
          );
      } else nativeGets++;
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }],
            },
          },
        ],
      });
    };
    await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    if (asyncMode) {
      // Changing channel protocol cannot change an accepted task's protocol snapshot.
      await repository.models.saveChannel(owner.userId, geminiChannel.id, {
        ...geminiSettings,
        adapter: "openai-images",
      });
      await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${nativeItem.id}`;
      await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    }
    await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    assert.equal(nativePosts, 1);
    assert.equal(nativeGets, asyncMode ? 1 : 0);
    assert.equal((await repository.get(geminiOwner, nativeJob.id))?.status, "succeeded");
    const [nativeSnapshot] =
      await sql`select provider_snapshot from generation_jobs where id=${nativeJob.id}`;
    assert.equal(nativeSnapshot?.provider_snapshot.adapter, "gemini-native");
  }
  assert.equal((await repository.wallet(geminiOwner)).balance, 0);
}

async function verifyGrokCompatibility(
  sql: postgres.Sql,
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  geminiSettings: {
    name: string;
    providerId: string;
    model: string;
    upstreamModel: string;
    adapter: string;
    mode: string;
    enabled: boolean;
    editsEnabled: boolean;
    maxReferences: number;
    timeoutMs: number;
    taskTimeoutSeconds: number;
    downloadOrigins: never[];
  },
  store: ImageStore,
  png: Buffer,
  deps: ImageProcessorDependencies,
) {
  for (const upstreamModel of ["grok-imagine-image-2.0", "seedream-5.0-pro"]) {
    const grokModel = `managed-${upstreamModel}`;
    await sql`insert into model_catalog(code,name,category,enabled) values (${grokModel},'Grok fixture','image',1)`;
    const grokOwner = await repository.provision(
      `grok-${crypto.randomUUID()}`,
      "grok-fixture",
      2 * imageUnitCredits,
    );
    const grokChannel = await repository.models.saveChannel(owner.userId, undefined, {
      ...geminiSettings,
      name: "Grok fixture",
      model: grokModel,
      upstreamModel,
      adapter: "fluxport-images",
      mode: "async-preferred",
      maxReferences: 1,
    });
    await repository.models.saveRoute(owner.userId, {
      tool: "create",
      model: grokModel,
      channelId: grokChannel.id,
    });
    const grokReference = await store.put(grokOwner, png);
    await repository.addReference(grokOwner, grokReference);
    const grokReferenceData = Buffer.from(await store.read(grokReference)).toString("base64");
    for (const edit of [false, true]) {
      const grokInput = imageGenerationInputSchema.parse({
        model: grokModel,
        prompt: "fixture",
        referenceAssetIds: edit ? [grokReference.id] : [],
      });
      const grokJob = await repository.create(grokOwner, grokInput, crypto.randomUUID(), 20, true);
      const grokItem = (await repository.get(grokOwner, grokJob.id))?.items[0];
      assert(grokItem);
      let posts = 0;
      let gets = 0;
      const request: typeof fetch = async (url, init) => {
        if (init?.method === "POST") {
          posts++;
          assert(String(url).endsWith(edit ? "/v1/images/edits" : "/v1/images/generations"));
          const payload = JSON.parse(String(init.body));
          assert.equal(payload.model, upstreamModel);
          assert.equal(payload.quality, undefined);
          assert.equal(payload.n, 1);
          if (edit) {
            assert.equal(payload.images[0].image_url, `data:image/png;base64,${grokReferenceData}`);
            return Response.json(
              {
                task_id: "grok-fixture",
                status: "queued",
                status_url: "/v1/images/tasks/grok-fixture?view=summary",
              },
              { status: 202 },
            );
          }
        } else gets++;
        return Response.json({ data: [{ b64_json: png.toString("base64") }] });
      };
      await processImageItem(grokItem.id, { ...deps, request });
      if (edit) {
        await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${grokItem.id}`;
        await processImageItem(grokItem.id, { ...deps, request });
      }
      await processImageItem(grokItem.id, { ...deps, request });
      assert.equal(posts, 1);
      assert.equal(gets, edit ? 1 : 0);
      assert.equal((await repository.get(grokOwner, grokJob.id))?.status, "succeeded");
    }
    assert.equal((await repository.wallet(grokOwner)).balance, 0);
    await sql`delete from model_routes where channel_id=${grokChannel.id}`;
  }
}
