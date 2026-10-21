import { imageModelsResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { expect, it, vi } from "vitest";
import { createApp } from "../../app";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
function fixture() {
  const create = vi
    .fn<ImageRepository["create"]>()
    .mockResolvedValue({ id: crypto.randomUUID(), replayed: false });
  const repository: ImageRepository = {
    close: unexpected,
    provision: unexpected,
    wallet: unexpected,
    walletEntries: unexpected,
    rechargeOrders: unexpected,
    createRecharge: unexpected,
    settleRecharge: unexpected,
    authenticate: async () => ({
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      role: "member",
    }),
    create,
    list: unexpected,
    get: unexpected,
    addReference: unexpected,
    listAssets: unexpected,
    asset: unexpected,
    leaseOutbox: unexpected,
    ackOutbox: unexpected,
    claim: unexpected,
    finish: unexpected,
    pruneEvents: unexpected,
    expireClaims: unexpected,
    reconcile: unexpected,
  };
  const store: ImageStore = {
    ready: unexpected,
    put: unexpected,
    read: unexpected,
    remove: unexpected,
  };
  const app = createApp(() => {}, {
    repository,
    store,
    enabled: true,
    unitCredits: 1,
    validate: validateModelInput,
    resolutions: supportedResolutions,
  });
  const submit = (quality?: unknown) =>
    app.request("/api/v1/image-tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: "fixture",
        ...(quality === undefined ? {} : { quality }),
      }),
    });
  return { create, submit, app };
}
it.each(["low", "medium", "high"])(
  "validates and forwards %s quality to task persistence",
  async (quality) => {
    const { create, submit } = fixture();
    const response = await submit(quality);
    expect(response.status).toBe(202);
    expect(unwrapApiData(await response.json())).toMatchObject({ replayed: false });
    expect(create.mock.calls[0]?.[1]).toMatchObject({ quality });
    expect(create.mock.calls[0]?.[3]).toBe(20);
  },
);
it("rejects unknown quality before creating a task and accepts legacy omitted quality", async () => {
  const { create, submit } = fixture();
  for (const quality of ["auto", "标准", null, 1]) expect((await submit(quality)).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
  expect((await submit()).status).toBe(202);
  expect(create.mock.calls[0]?.[1]).not.toHaveProperty("quality");
});

it("advertises and enforces the same per-model resolution policy", async () => {
  const { app, create } = fixture();
  const headers = { Authorization: "Bearer fixture", "Content-Type": "application/json" };
  const response = await app.request("/api/v1/image-models", { headers });
  const body = imageModelsResponseSchema.parse(unwrapApiData(await response.json()));
  expect(body.models.map((model) => model.id)).toEqual([
    "gpt-image-2",
    "gpt-image-2.5",
    "nano-banana-2.1",
  ]);
  expect(body.unitCredits).toBe(20);
  for (const model of body.models) {
    const expected = ["1K", "2K", "4K"];
    expect(model.enabledResolutions).toEqual(expected);
    for (const resolution of ["1K", "2K", "4K"]) {
      const result = await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ model: model.id, prompt: "fixture", resolution }),
      });
      expect(result.status).toBe(expected.includes(resolution) ? 202 : 400);
    }
  }
  expect(create).toHaveBeenCalledTimes(9);
});
