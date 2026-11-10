import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  imageSubmissionResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { createApp } from "../../../api/src/app";

/** 隔离库验证风格复制的历史归属、原子幂等扣费和跨组织拒绝。 */
export async function verifyReplica(
  repository: ImageRepository,
  store: ImageStore,
  png: Uint8Array,
) {
  const owner = await repository.provision(`replica-${crypto.randomUUID()}`, "replica-test", 20);
  const other = await repository.provision(
    `replica-other-${crypto.randomUUID()}`,
    "other-test",
    20,
  );
  const ids: string[] = [];
  for (let index = 0; index < 2; index++) {
    const asset = await store.put(owner, png, crypto.randomUUID());
    await repository.addReference(owner, asset);
    ids.push(asset.id);
  }
  const app = createApp(undefined, {
    repository,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 2,
    validate: (input) => validateModelInput(input, {}, true),
    resolutions: supportedResolutions,
  });
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2.6",
    prompt: "style fixture",
    replica: true,
    referenceAssetIds: ids,
    referenceRoles: ["style", "product"],
    resolution: "1.5K",
  });
  const headers = {
    Authorization: `Bearer ${owner.token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const submit = () =>
    app.request("/api/v1/image-tasks", { method: "POST", headers, body: JSON.stringify(input) });
  const response = await submit();
  assert.equal(response.status, 202);
  const task = imageSubmissionResponseSchema.parse(unwrapApiData(await response.json()));
  assert.equal((await submit()).status, 200);
  assert.equal((await repository.wallet(owner)).balance, 18);
  assert.equal((await repository.list(owner, 20, undefined, "replica"))[0]?.id, task.id);
  assert.equal((await repository.list(owner, 20, undefined, "create")).length, 0);
  assert.equal((await repository.list(other, 20, undefined, "replica")).length, 0);
  const forbidden = await app.request("/api/v1/image-tasks", {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${other.token}`,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  assert.equal(forbidden.status, 400);
  assert.equal((await repository.wallet(other)).balance, 20);
}
