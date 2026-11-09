import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { describe, expect, it, vi } from "vitest";
import { configuredProviderCall } from "../providers/configured-provider";

describe.each(["grok-imagine-image-2.0", "seedream-5.0-pro"])("%s", (upstreamModel) => {
  const snapshot = providerSnapshotSchema.parse({
    channelId: crypto.randomUUID(),
    credentialId: crypto.randomUUID(),
    origin: "https://provider.example.com",
    adapter: "fluxport-images",
    model: "catalog-grok-fixture",
    upstreamModel,
    mode: "async-preferred",
    editsEnabled: true,
    maxReferences: 1,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  const input = imageGenerationInputSchema.parse({
    model: snapshot.model,
    prompt: "fixture",
    aspectRatio: "3:4",
    quality: "high",
  });
  it.each(["1K", "2K", "4K"] as const)(
    "builds %s Images requests without undeclared quality",
    async (resolution) => {
      for (const references of [[], [new Uint8Array([1, 2])]]) {
        const request = vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
        const result = await configuredProviderCall(
          snapshot,
          "fixture-key",
          { ...input, resolution },
          references,
          "grok-item",
          undefined,
          request,
        );
        expect(result.kind).toBe("complete");
        expect(String(request.mock.calls[0]?.[0])).toBe(
          `https://provider.example.com/v1/images/${references.length ? "edits" : "generations"}`,
        );
        expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("Content-Type")).toBe(
          "application/json",
        );
        const payload = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
        expect(payload).toEqual({
          model: upstreamModel,
          prompt: input.prompt,
          n: 1,
          size: { "1K": "768x1024", "2K": "1536x2048", "4K": "2880x3840" }[resolution],
          async: true,
          response_format: "url",
          ...(references.length ? { images: [{ image_url: "data:image/png;base64,AQI=" }] } : {}),
        });
        expect(payload).not.toHaveProperty("quality");
        expect(request).toHaveBeenCalledTimes(1);
        expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("Idempotency-Key")).toBe(
          "grok-item",
        );
      }
    },
  );
  it("polls an accepted Images task without another paid submission", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            task_id: "grok-task",
            status: "queued",
            status_url: "/v1/images/tasks/grok-task?view=summary",
          },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          task_id: "grok-task",
          status: "success",
          assets: [{ url: "/v1/images/tasks/grok-task/assets/result.png" }],
        }),
      );
    const accepted = await configuredProviderCall(
      snapshot,
      "fixture-key",
      input,
      [],
      "grok-item",
      undefined,
      request,
    );
    if (accepted.kind !== "pending") throw Error("missing async receipt");
    const done = await configuredProviderCall(
      snapshot,
      "fixture-key",
      input,
      [],
      "grok-item",
      accepted,
      request,
    );
    expect(done.kind).toBe("complete");
    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "GET"]);
    expect(request.mock.calls[1]?.[1]?.body).toBeUndefined();
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).has("Idempotency-Key")).toBe(false);
  });
});
