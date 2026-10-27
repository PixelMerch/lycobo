import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import {
  configuredProviderCall,
  providerOutputBytes,
  providerTaskPath,
} from "./configured-provider";
import { openProviderKey, sealProviderKey } from "./provider-secrets";

const snapshot = providerSnapshotSchema.parse({
  channelId: crypto.randomUUID(),
  credentialId: crypto.randomUUID(),
  origin: "https://api.example.com",
  adapter: "fluxport-images",
  model: "gpt-image-2",
  upstreamModel: "vendor-image",
  mode: "async-preferred",
  editsEnabled: true,
  resolutions: ["1K"],
  maxReferences: 6,
  timeoutMs: 5000,
  taskTimeoutSeconds: 600,
  downloadOrigins: ["https://cdn.example.com"],
});
const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "fixture" });
it("accepts synchronous results even when async is preferred and sends provider-specific references", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
  expect(
    await configuredProviderCall(
      snapshot,
      "fixture-key",
      input,
      [new Uint8Array([1, 2])],
      "item",
      undefined,
      request,
    ),
  ).toMatchObject({ kind: "complete" });
  const call = request.mock.calls[0];
  expect(String(call?.[0])).toBe("https://api.example.com/v1/images/edits");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    model: "vendor-image",
    async: true,
    images: [{ image_url: "data:image/png;base64,AQI=" }],
  });
  expect(request).toHaveBeenCalledTimes(1);
});
it("stores accepted task identity and polls without resubmitting or attaching a paid idempotency header", async () => {
  const submit = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        task_id: "task-1",
        status: "queued",
        status_url: "/v1/images/tasks/task-1?view=summary",
        poll_after_ms: 3000,
      },
      { status: 202 },
    ),
  );
  const result = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    undefined,
    submit,
  );
  expect(result).toMatchObject({ kind: "pending", taskId: "task-1", delayMs: 3000 });
  if (result.kind !== "pending") throw new Error("Expected receipt");
  const poll = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ status: "success", assets: [{ url: "/v1/images/assets/result-1" }] }),
    );
  expect(
    await configuredProviderCall(snapshot, "fixture-key", input, [], "item", result, poll),
  ).toMatchObject({ kind: "complete" });
  expect(poll.mock.calls[0]?.[1]).toMatchObject({
    method: "GET",
    headers: { Authorization: "Bearer fixture-key" },
  });
  expect(poll.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Idempotency-Key");
});
it("does not send credentials to result CDNs, redirects, or untrusted task origins", async () => {
  expect(() =>
    providerTaskPath("https://evil.example.com/v1/images/tasks/a", snapshot.origin),
  ).toThrow("PROVIDER_UNTRUSTED_TASK_URL");
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("image"));
  await providerOutputBytes(
    { url: "https://cdn.example.com/result.png" },
    snapshot,
    "fixture-key",
    request,
  );
  expect(request.mock.calls[0]?.[1]?.headers).toEqual({});
  expect(request.mock.calls[0]?.[1]?.redirect).toBe("manual");
  await expect(
    providerOutputBytes({ url: "http://127.0.0.1/private" }, snapshot, "fixture-key", request),
  ).rejects.toMatchObject({ code: "PROVIDER_UNTRUSTED_RESULT_URL" });
  expect(request).toHaveBeenCalledTimes(1);
});
it("preserves uncertain outcomes and never treats a paused polling policy as a fresh submission", async () => {
  for (const reply of [
    { task_id: "x", status: "uncertain" },
    { task_id: "x", status: "running", auto_poll: false },
  ]) {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(reply));
    await expect(
      configuredProviderCall(snapshot, "fixture-key", input, [], "item", undefined, request),
    ).rejects.toMatchObject({ unknownOutcome: true });
    expect(request).toHaveBeenCalledTimes(1);
  }
});
it("authenticates encrypted credential versions and rejects tampering or a different master key", async () => {
  const secret = Buffer.alloc(32, 1).toString("base64");
  const cipher = await sealProviderKey("sensitive-fixture-key", secret);
  expect(cipher).not.toContain("sensitive-fixture-key");
  expect(await openProviderKey(cipher, secret)).toBe("sensitive-fixture-key");
  await expect(openProviderKey(cipher, Buffer.alloc(32, 2).toString("base64"))).rejects.toThrow();
  await expect(openProviderKey(`${cipher.slice(0, -5)}AAAAA`, secret)).rejects.toThrow();
});
it("follows the JSON result endpoint after a summary and preserves explicit failure semantics", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      status: "success",
      task_id: "done",
      result_url: "/v1/images/tasks/done?view=summary",
    }),
  );
  const pending = { taskId: "done", statusPath: "/v1/images/tasks/done?view=summary" };
  expect(
    await configuredProviderCall(snapshot, "fixture-key", input, [], "item", pending, request),
  ).toMatchObject({ kind: "pending", statusPath: "/v1/images/tasks/done" });
  request.mockResolvedValue(Response.json({ status: "failed", retryable: false }));
  await expect(
    configuredProviderCall(snapshot, "fixture-key", input, [], "item", pending, request),
  ).rejects.toMatchObject({ code: "PROVIDER_TASK_FAILED", unknownOutcome: false });
  request.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(
    configuredProviderCall(snapshot, "fixture-key", input, [], "item", pending, request),
  ).rejects.toMatchObject({ code: "PROVIDER_POLL_STOPPED", unknownOutcome: true });
  request.mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "30" } }));
  await expect(
    configuredProviderCall(snapshot, "fixture-key", input, [], "item", pending, request),
  ).rejects.toMatchObject({ delayMs: 30000 });
});
