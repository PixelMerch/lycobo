import assert from "node:assert/strict";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { sealProviderKey } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import {
  verifyCatalogPresentation,
  verifyDynamicCatalog,
  verifyLegacyModelMigration,
  verifyManagedApiAccess,
} from "./verify-managed-catalog";
import { verifyAsyncModelExecution } from "./verify-managed-execution";
import { verifyGeminiModel } from "./verify-managed-gemini";
import { verifyManagedTextile } from "./verify-managed-textile";
export async function verifyManagedModels(
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Buffer,
) {
  await verifyCatalogPresentation(sql, repository);
  const owner = await repository.provision(
    `managed-${crypto.randomUUID()}`,
    "managed-fixture",
    200,
  );
  const secret = Buffer.alloc(32, 7).toString("base64");
  const key = "fixture-upstream-key";
  const provider = await repository.models.saveProvider(
    owner.userId,
    undefined,
    {
      name: "Fixture provider",
      origin: "https://provider.example.com",
      adapter: "fluxport-images",
      enabled: true,
    },
    await sealProviderKey("fixture-provider-default-key", secret),
  );
  const channel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Fixture channel",
    providerId: provider.id,
    model: "gpt-image-2",
    upstreamModel: "fixture-upstream",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  // The selected channel key, rather than the provider default, is snapshotted.
  const [credential] =
    await sql`insert into model_credentials(ciphertext) values (${await sealProviderKey(key, secret)}) returning id`;
  assert(credential);
  const [channelKey] =
    await sql`insert into model_provider_keys(provider_id,credential_id,name,enabled) values (${provider.id},${credential.id},'Channel fixture key',1) returning id`;
  assert(channelKey);
  await sql`update model_channels set key_id=${channelKey.id} where id=${channel.id}`;
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "gpt-image-2",
    channelId: channel.id,
  });
  await verifyManagedApiAccess(repository, secret, store, owner);
  await verifyDynamicCatalog(sql, repository, owner, provider);
  await verifyLegacyModelMigration(repository, owner, provider, sql);
  const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "fixture" });
  await sql`update model_provider_keys set enabled=0 where id=${channelKey.id}`;
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200);
  await sql`update model_provider_keys set enabled=1 where id=${channelKey.id}`;
  await sql`update model_catalog set enabled=0 where code='gpt-image-2'`;
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200);
  await sql`update model_catalog set enabled=1 where code='gpt-image-2'`;
  const deps = await verifyAsyncModelExecution(
    repository,
    owner,
    input,
    key,
    png,
    store,
    secret,
    sql,
    provider,
  );
  // v5 must never silently fall back to legacy model aliases when a route is absent.
  const textileChannel = await verifyManagedTextile(
    store,
    owner,
    png,
    repository,
    provider,
    key,
    secret,
    deps,
    sql,
  );
  await verifyGeminiModel(repository, provider, owner, sql, deps, png, store);
  await sql`delete from model_routes where channel_id=${textileChannel.id}`;
  // Subsequent integration cases must retain their original routing policy.
  await sql`delete from model_routes where channel_id=${channel.id}`;
  console.info(
    "Managed model API separation, encrypted keys, route snapshots, async submit/poll, wallet idempotency and legacy fallback passed (fixture only)",
  );
}
