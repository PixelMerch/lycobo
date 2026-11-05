import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { createApp } from "../../api/src/app";

export async function verifyCatalogPresentation(sql: postgres.Sql, repository: ImageRepository) {
  await sql`update model_catalog set logo_url='https://logos.example.com/image2.webp' where code='gpt-image-2'`;
  const logos = await repository.models.logos();
  if (
    logos.models.find((m) => m.id === "gpt-image-2")?.logoUrl !==
    "https://logos.example.com/image2.webp"
  )
    throw new Error("Configured model logo was not exposed");
  if (
    logos.models.some((m) =>
      Object.keys(m).some(
        (key) => !["id", "logoUrl", "name", "description", "capabilitySummary"].includes(key),
      ),
    )
  )
    throw new Error("Provider configuration leaked through model logos");
  await sql`insert into model_catalog(code,name,category,logo_url,enabled) values ('gemini-3.1-flash-image-preview','Banana fixture','image','https://logos.example.com/banana.webp',1)`;
  assert.equal(
    (await repository.models.logos()).models.find((m) => m.id === "gemini-3.1-flash-image-preview")
      ?.logoUrl,
    "https://logos.example.com/banana.webp",
  );
  await sql`update model_catalog set logo_url='https://logos.example.com/canonical.webp' where code='nano-banana-2.1'`;
  assert.equal(
    (await repository.models.logos()).models.find((m) => m.id === "nano-banana-2.1")?.logoUrl,
    "https://logos.example.com/canonical.webp",
  );
  await sql`update model_catalog set name='目录显示名称',description='后台介绍',capability_summary='后台能力' where code='gpt-image-2'`;
  assert.deepEqual(
    (await repository.models.logos()).models.find((m) => m.id === "gpt-image-2"),
    {
      id: "gpt-image-2",
      name: "目录显示名称",
      logoUrl: "https://logos.example.com/image2.webp",
      description: "后台介绍",
      capabilitySummary: "后台能力",
    },
  );
  await sql`update model_catalog set sort_order=-10 where code='gpt-image-2.5'`;
  assert.equal((await repository.models.logos()).models[0]?.id, "gpt-image-2.5");
}

export async function verifyDynamicCatalog(
  sql: postgres.Sql,
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  provider: { id: string },
) {
  await sql`insert into model_catalog(code,name,category,enabled) values ('custom-image-v7','新图片模型','image',1),('hidden-image','未启用','image',0),('custom-video','视频','video',1)`;
  const publicCatalog = (await repository.models.logos()).models;
  assert(publicCatalog.some((model) => model.id === "custom-image-v7"));
  assert(!publicCatalog.some((model) => ["hidden-image", "custom-video"].includes(model.id)));
  const customInput = imageGenerationInputSchema.parse({
    model: "custom-image-v7",
    prompt: "fixture",
  });
  await assert.rejects(
    repository.create(owner, customInput, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  const customChannel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Dynamic channel",
    providerId: provider.id,
    model: "custom-image-v7",
    upstreamModel: "custom-provider-v7",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["2K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "custom-image-v7",
    channelId: customChannel.id,
  });
  assert(
    (await repository.models.capabilities()).create?.some(
      (model) => model.id === "custom-image-v7" && model.enabledResolutions.includes("2K"),
    ),
  );
  const customOwner = await repository.provision(
    `dynamic-${crypto.randomUUID()}`,
    "dynamic-fixture",
    20,
  );
  const dynamicTask = await repository.create(
    customOwner,
    { ...customInput, resolution: "2K" },
    crypto.randomUUID(),
  );
  const resolutionOwner = await repository.provision(
    `all-resolutions-${crypto.randomUUID()}`,
    "resolution-fixture",
    60,
  );
  assert.deepEqual(
    (await repository.models.capabilities()).create?.find((model) => model.id === "custom-image-v7")
      ?.enabledResolutions,
    ["1K", "1.5K", "2K", "4K"],
  );
  for (const resolution of ["1K", "1.5K", "4K"] as const) {
    const created = await repository.create(
      resolutionOwner,
      { ...customInput, resolution },
      crypto.randomUUID(),
      20,
      true,
    );
    const [stored] =
      await sql`select resolution,provider_snapshot from generation_jobs where id=${created.id}`;
    assert.equal(stored?.resolution, resolution);
    assert.deepEqual(stored?.provider_snapshot.resolutions, ["1K", "1.5K", "2K", "4K"]);
  }
  const [dynamicSnapshot] =
    await sql`select provider_snapshot from generation_jobs where id=${dynamicTask.id}`;
  assert.equal(dynamicSnapshot?.provider_snapshot.upstreamModel, "custom-provider-v7");
}

export async function verifyLegacyModelMigration(
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  provider: { id: string },
  sql: postgres.Sql,
) {
  const legacyOwner = await repository.provision(
    `legacy-upgrade-${crypto.randomUUID()}`,
    "legacy-fixture",
    40,
  );
  const legacyInput = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "fixture",
  });
  const legacyJob = await repository.create(legacyOwner, legacyInput, crypto.randomUUID());
  const legacyItem = (await repository.get(legacyOwner, legacyJob.id))?.items[0];
  assert(legacyItem);
  const claimed = await repository.claim(legacyItem.id, "legacy-fixture", 10000);
  assert(claimed);
  await repository.finish(claimed, { errorCode: "PROVIDER_HTTP_400", unknown: false });
  const retryKey = crypto.randomUUID();
  await assert.rejects(
    repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(legacyOwner)).balance, 40);
  const replacement = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Legacy replacement",
    providerId: provider.id,
    model: "gpt-image-2.5",
    upstreamModel: "new-managed-image",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "gpt-image-2.5",
    channelId: replacement.id,
  });
  await repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true);
  assert.equal(
    (await repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true)).replayed,
    true,
  );
  assert.equal((await repository.wallet(legacyOwner)).balance, 40 - imageUnitCredits);
  const [upgraded] =
    await sql`select provider_snapshot from generation_jobs where id=${legacyJob.id}`;
  assert.equal(upgraded?.provider_snapshot.upstreamModel, "new-managed-image");
  await sql`delete from model_routes where channel_id=${replacement.id}`;
}

export async function verifyManagedApiAccess(
  repository: ImageRepository,
  secret: string,
  store: ImageStore,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
) {
  const app = createApp(undefined, {
    repository,
    modelSecret: secret,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 20,
    validate: (i) => validateModelInput(i, {}, true),
    resolutions: supportedResolutions,
  });
  // Management is owned by the independent admin API, even for business administrators.
  assert.equal(
    (
      await app.request("/api/v1/model-management", {
        headers: { Authorization: `Bearer ${owner.token}` },
      })
    ).status,
    404,
  );
}
