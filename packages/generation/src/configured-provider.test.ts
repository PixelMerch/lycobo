import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import {
  configuredProviderCall,
  providerOutputBytes,
  providerTaskPath,
} from "./configured-provider";
import { openProviderKey, sealProviderKey } from "./provider-secrets";
import { normalizeTextileGeneration, textileItemInput } from "./textile-generation";

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
it("uses the documented gpt-image-2.5 JSON edit protocol with private references in order", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ url: "/v1/images/tasks/task/assets/a.png" }] }));
  const current = { ...snapshot, upstreamModel: "gpt-image-2.5" };
  await configuredProviderCall(
    current,
    "fixture-key",
    input,
    [new Uint8Array([1]), new Uint8Array([2])],
    "item-v5",
    undefined,
    request,
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
    model: "gpt-image-2.5",
    n: 1,
    async: true,
    response_format: "url",
    images: [
      { image_url: "data:image/png;base64,AQ==" },
      { image_url: "data:image/png;base64,Ag==" },
    ],
  });
});
it("accepts assets despite empty data or a completed polling-stop flag and handles paused tasks safely", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      status: "success",
      auto_poll: false,
      data: [],
      assets: [{ url: "/v1/images/tasks/a/assets/result.png" }],
    }),
  );
  expect(
    await configuredProviderCall(
      snapshot,
      "fixture-key",
      input,
      [],
      "item",
      { taskId: "a", statusPath: "/v1/images/tasks/a" },
      request,
    ),
  ).toMatchObject({ kind: "complete" });
  for (const status of ["paused", "canceled"]) {
    request.mockResolvedValue(Response.json({ task_id: "a", status }));
    await expect(
      configuredProviderCall(snapshot, "fixture-key", input, [], "item", undefined, request),
    ).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN", unknownOutcome: true });
  }
  request.mockResolvedValue(
    Response.json(
      { task_id: "a", status: "running", poll_url: "/v1/images/tasks/a" },
      { status: 202 },
    ),
  );
  expect(
    await configuredProviderCall(snapshot, "fixture-key", input, [], "item", undefined, request),
  ).toMatchObject({ kind: "pending", statusPath: "/v1/images/tasks/a" });
});
it.each(["https://api.example.com", "https://api.example.com/"])(
  "%s falls back to its protected image without another generation",
  async (origin) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response("image"));
    const result = await providerOutputBytes(
      {
        signed_url: "https://cdn.example.com/expired.png",
        download_url: "/v1/images/tasks/a/assets/result.png?download=1",
      },
      { ...snapshot, origin },
      "fixture-key",
      request,
    );
    expect(result.toString()).toBe("image");
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({});
    expect(request.mock.calls[1]?.[1]?.headers).toEqual({ Authorization: "Bearer fixture-key" });
    expect(request.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(
      true,
    );
    expect(request).toHaveBeenCalledTimes(2);
  },
);
it("decodes inline image URLs and rejects malformed base64 without network calls", async () => {
  const request = vi.fn<typeof fetch>();
  expect(
    (
      await providerOutputBytes(
        { url: "data:image/png;base64,aGVsbG8=" },
        snapshot,
        "fixture-key",
        request,
      )
    ).toString(),
  ).toBe("hello");
  await expect(
    providerOutputBytes({ b64_json: "a" }, snapshot, "fixture-key", request),
  ).rejects.toMatchObject({ code: "PROVIDER_UNRECOGNIZED_RESPONSE" });
  expect(request).not.toHaveBeenCalled();
});

it("continues polling accepted tasks that forbid resubmission and fetches completed summaries", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        task_id: "accepted-task",
        status: "queued",
        retryable: false,
        auto_poll: true,
        status_url: "/v1/images/tasks/accepted-task?view=summary",
      },
      { status: 202 },
    ),
  );
  const pending = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    undefined,
    request,
  );
  expect(pending).toMatchObject({ kind: "pending", taskId: "accepted-task" });
  if (pending.kind !== "pending") throw new Error("Expected accepted task");
  request.mockResolvedValue(
    Response.json({
      task_id: "accepted-task",
      status: "success",
      retryable: false,
      auto_poll: false,
      result_url: "/v1/images/tasks/accepted-task",
    }),
  );
  expect(
    await configuredProviderCall(snapshot, "fixture-key", input, [], "item", pending, request),
  ).toMatchObject({ kind: "pending", statusPath: "/v1/images/tasks/accepted-task" });
});

it.each([
  ["1K", "gpt-image-2.5-flare", "1024x1024"],
  ["2K", "gpt-image-2.5-flare", "2048x2048"],
  ["4K", "gpt-image-2", "3840x3840"],
] as const)("selects the snapshotted upstream model for %s", async (resolution, model, size) => {
  const mapping = { "1K": "gpt-image-2.5-flare", "2K": "gpt-image-2.5-flare", "4K": "gpt-image-2" };
  const configured = providerSnapshotSchema.parse({
    ...snapshot,
    resolutions: ["1K", "2K", "4K"],
    upstreamModelsByResolution: mapping,
  });
  mapping[resolution] = "changed-after-submission";
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
  await configuredProviderCall(
    configured,
    "fixture-key",
    { ...input, resolution },
    [],
    "item",
    undefined,
    request,
  );
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ model, size });
  expect(request).toHaveBeenCalledTimes(1);
});

it("sends each textile view with its own prompt, full references and independent request identity", async () => {
  const input = normalizeTextileGeneration(
    imageGenerationInputSchema.parse({
      model: "gpt-image-2.5",
      prompt: "摘要",
      resolution: "4K",
      aspectRatio: "1:1",
      count: 2,
      referenceAssetIds: [crypto.randomUUID()],
      textileSet: { version: 5, views: ["overhead-close", "draped"] },
    }),
  );
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
  const references = [new Uint8Array([1, 2, 3])];
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [position, id] of ids.entries()) {
    await configuredProviderCall(
      { ...snapshot, upstreamModel: "gpt-image-2.5", resolutions: ["4K"] },
      "fixture-key",
      textileItemInput(input, position),
      references,
      id,
      undefined,
      request,
    );
  }
  expect(request).toHaveBeenCalledTimes(2);
  const payloads = request.mock.calls.map(([url, init]) => {
    expect(String(url)).toBe("https://api.example.com/v1/images/edits");
    return JSON.parse(String(init?.body));
  });
  expect(payloads[0].prompt).toContain("拍摄要求：俯拍近景");
  expect(payloads[1].prompt).toContain("拍摄要求：被子拖地");
  expect(payloads[1].prompt).not.toContain("拍摄要求：俯拍近景");
  for (const [position, payload] of payloads.entries()) {
    expect(payload).toMatchObject({
      model: "gpt-image-2.5",
      size: "3840x3840",
      n: 1,
      images: [{ image_url: "data:image/png;base64,AQID" }],
    });
    expect(new Headers(request.mock.calls[position]?.[1]?.headers).get("Idempotency-Key")).toBe(
      ids[position],
    );
  }
  expect(payloads[0].images).toEqual(payloads[1].images);
});
