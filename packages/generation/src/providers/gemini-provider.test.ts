import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { configuredProviderCall, providerOutputBytes } from "./configured-provider";

const snapshot = providerSnapshotSchema.parse({
  channelId: crypto.randomUUID(),
  credentialId: crypto.randomUUID(),
  origin: "https://provider.example.com",
  adapter: "gemini-native",
  model: "gemini-3.1-flash-image-preview",
  upstreamModel: "gemini-3.1-flash-image-preview",
  mode: "async-preferred",
  editsEnabled: true,
  maxReferences: 5,
  timeoutMs: 5000,
  taskTimeoutSeconds: 600,
  downloadOrigins: ["https://cdn.example.com"],
});
const input = imageGenerationInputSchema.parse({
  model: snapshot.model,
  prompt: "保留商品",
  aspectRatio: "3:4",
});
const native = () => ({
  candidates: [
    {
      content: {
        parts: [{ text: "done" }, { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } }],
      },
    },
  ],
});
it.each(["1K", "2K", "4K"] as const)(
  "uses native Gemini text/reference requests for %s without Images API fields",
  async (resolution) => {
    for (const references of [[], [new Uint8Array([1, 2]), new Uint8Array([3, 4])]]) {
      const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(native()));
      const result = await configuredProviderCall(
        snapshot,
        "fixture-key",
        { ...input, resolution },
        references,
        "item-1",
        undefined,
        request,
      );
      expect(result.kind).toBe("complete");
      if (result.kind !== "complete") throw Error("missing image");
      expect(await providerOutputBytes(result.outputs[0] ?? {}, snapshot, "fixture-key")).toEqual(
        Buffer.from("hello"),
      );
      const call = request.mock.calls[0];
      expect(String(call?.[0])).toBe(
        "https://provider.example.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
      );
      const body = JSON.parse(String(call?.[1]?.body));
      expect(body).toEqual({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              ...references.map((bytes) => ({
                inlineData: { mimeType: "image/png", data: Buffer.from(bytes).toString("base64") },
              })),
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: "3:4", imageSize: resolution },
        },
      });
      expect(new Headers(call?.[1]?.headers).get("Authorization")).toBe("Bearer fixture-key");
      expect(new Headers(call?.[1]?.headers).get("Idempotency-Key")).toBe("item-1");
      expect(request).toHaveBeenCalledTimes(1);
    }
  },
);
it("polls accepted Gemini tasks and reads native results without submitting twice", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        {
          task_id: "gemini-1",
          status: "queued",
          status_url: "/v1/images/tasks/gemini-1?view=summary",
        },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({
        task_id: "gemini-1",
        status: "success",
        result_url: "/v1/images/tasks/gemini-1",
      }),
    )
    .mockResolvedValueOnce(Response.json(native()));
  const accepted = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    undefined,
    request,
  );
  if (accepted.kind !== "pending") throw Error("missing task");
  const summary = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    accepted,
    request,
  );
  if (summary.kind !== "pending") throw Error("missing result fetch");
  const done = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    summary,
    request,
  );
  expect(done.kind).toBe("complete");
  expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "GET", "GET"]);
  expect(request.mock.calls[2]?.[1]?.body).toBeUndefined();
  expect(new Headers(request.mock.calls[1]?.[1]?.headers).has("Idempotency-Key")).toBe(false);
});
it("supports fileData using the same download allowlist and excludes thought images", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, inlineData: { mimeType: "image/png", data: "dGhvdWdodA==" } },
              {
                fileData: {
                  mimeType: "image/png",
                  fileUri: "https://cdn.example.com/result.png",
                },
              },
            ],
          },
        },
      ],
    }),
  );
  const result = await configuredProviderCall(
    snapshot,
    "fixture-key",
    input,
    [],
    "item",
    undefined,
    request,
  );
  expect(result).toMatchObject({
    kind: "complete",
    outputs: [{ url: "https://cdn.example.com/result.png" }],
  });
  await expect(
    providerOutputBytes({ url: "https://untrusted.example/result.png" }, snapshot, "fixture-key"),
  ).rejects.toThrow("PROVIDER_UNTRUSTED_RESULT_URL");
});
it.each([
  { candidates: [{ content: { parts: [{ text: "no image" }] } }] },
  {
    candidates: [
      { content: { parts: [{ inlineData: { mimeType: "text/html", data: "aGVsbG8=" } }] } },
    ],
  },
  { candidates: [] },
])(
  "never treats text-only, non-image or empty Gemini output as generation success",
  async (body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    await expect(
      configuredProviderCall(snapshot, "fixture-key", input, [], "item", undefined, request),
    ).rejects.toThrow("PROVIDER_UNRECOGNIZED_RESPONSE");
    expect(request).toHaveBeenCalledTimes(1);
  },
);
