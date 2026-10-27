import { type ImageGenerationInput, imageLimits, type ProviderSnapshot } from "@lycoboai/contracts";
import { z } from "zod";
import { VakvError } from "./vakv-provider";

const asset = z.object({
  url: z.string().optional(),
  b64_json: z.string().optional(),
  signed_url: z.string().optional(),
  download_url: z.string().optional(),
});
const reply = z.object({
  task_id: z.string().min(1).max(200).optional(),
  status: z.string().optional(),
  status_url: z.string().optional(),
  poll_after_ms: z.number().optional(),
  auto_poll: z.boolean().optional(),
  retryable: z.boolean().optional(),
  data: z.array(asset).optional(),
  assets: z.array(asset).optional(),
  result_url: z.string().optional(),
});
export class ProviderPollError extends VakvError {
  constructor(
    code: string,
    readonly delayMs: number,
  ) {
    super(code, true);
  }
}
export type ProviderResult =
  | { kind: "complete"; outputs: z.infer<typeof asset>[] }
  | { kind: "pending"; taskId: string; statusPath: string; delayMs: number };
export function providerTaskPath(value: string, origin: string) {
  const url = new URL(value, origin);
  if (
    url.origin !== new URL(origin).origin ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1/images/tasks/")
  )
    throw new VakvError("PROVIDER_UNTRUSTED_TASK_URL", true);
  return url.pathname + url.search;
}
async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new VakvError("PROVIDER_EMPTY_RESPONSE", true);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > imageLimits.providerResponseBytes)
        throw new VakvError("PROVIDER_RESPONSE_TOO_LARGE", true);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new VakvError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  }
}
export async function configuredProviderCall(
  snapshot: ProviderSnapshot,
  key: string,
  input: ImageGenerationInput,
  references: Uint8Array[],
  idempotencyKey: string,
  pending?: { taskId: string; statusPath: string },
  request: typeof fetch = fetch,
): Promise<ProviderResult> {
  const isPoll = !!pending;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let body: FormData | string | undefined;
  if (!isPoll) {
    headers["Idempotency-Key"] = idempotencyKey;
    const [w, h] = input.aspectRatio.split(":").map(Number);
    const edge = { "1K": 1024, "2K": 2048, "4K": 4096 }[input.resolution];
    const scale = edge / Math.max(w ?? 1, h ?? 1);
    const size = `${Math.round(((w ?? 1) * scale) / 16) * 16}x${Math.round(((h ?? 1) * scale) / 16) * 16}`;
    const payload = {
      model: snapshot.upstreamModel,
      prompt: input.prompt,
      size,
      n: 1,
      quality: input.quality ?? "medium",
      response_format: "b64_json",
      ...(snapshot.adapter === "fluxport-images" && snapshot.mode !== "provider-default"
        ? { async: snapshot.mode === "async-preferred" }
        : {}),
    };
    if (snapshot.adapter === "fluxport-images" || !references.length) {
      body = JSON.stringify({
        ...payload,
        ...(references.length
          ? {
              images: references.map((bytes) => ({
                image_url: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
              })),
            }
          : {}),
      });
      headers["Content-Type"] = "application/json";
    } else {
      const form = new FormData();
      for (const [k, v] of Object.entries(payload)) form.set(k, String(v));
      for (const bytes of references)
        form.append(
          "image[]",
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          "reference.png",
        );
      body = form;
    }
  }
  const path = pending
    ? providerTaskPath(pending.statusPath, snapshot.origin)
    : references.length
      ? "/v1/images/edits"
      : "/v1/images/generations";
  const response = await request(new URL(path, snapshot.origin), {
    method: isPoll ? "GET" : "POST",
    headers,
    ...(body ? { body } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(isPoll ? 30000 : snapshot.timeoutMs),
  });
  if (
    isPoll &&
    (["stop"].includes(response.headers.get("X-FluxPort-Poll-Action") ?? "") ||
      [401, 403, 404, 410].includes(response.status))
  ) {
    await response.body?.cancel();
    throw new VakvError("PROVIDER_POLL_STOPPED", true);
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (isPoll && (response.status === 429 || response.status >= 500)) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : retryAfter
          ? Date.parse(retryAfter) - Date.now()
          : 0;
      throw new ProviderPollError(
        `PROVIDER_HTTP_${response.status}`,
        Number.isFinite(delay) ? Math.max(0, delay) : 0,
      );
    }
    throw new VakvError(
      `PROVIDER_HTTP_${response.status}`,
      isPoll || ![400, 401, 403, 404, 413, 415, 422, 429].includes(response.status),
    );
  }
  const parsed = reply.safeParse(await readJson(response));
  if (!parsed.success) throw new VakvError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  const result = parsed.data;
  if (result.status === "failed") throw new VakvError("PROVIDER_TASK_FAILED", false);
  if (
    ["uncertain", "client_disconnected"].includes(result.status ?? "") ||
    result.auto_poll === false ||
    result.retryable === false
  )
    throw new VakvError("PROVIDER_OUTCOME_UNKNOWN", true);
  const outputs = (result.data ?? result.assets ?? []).filter(
    (output) => output.url || output.b64_json || output.signed_url || output.download_url,
  );
  if (
    outputs.length &&
    (!result.status || result.status === "success" || result.status === "succeeded")
  )
    return { kind: "complete", outputs };
  const taskId = result.task_id ?? pending?.taskId;
  if (snapshot.adapter !== "fluxport-images" || !taskId)
    throw new VakvError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  let statusPath = providerTaskPath(
    result.status_url ??
      pending?.statusPath ??
      `/v1/images/tasks/${encodeURIComponent(taskId)}?view=summary`,
    snapshot.origin,
  );
  if (result.status === "success" || result.status === "succeeded") {
    const full = new URL(result.result_url ?? statusPath, snapshot.origin);
    full.searchParams.delete("view");
    statusPath = providerTaskPath(full.href, snapshot.origin);
  }
  return { kind: "pending", taskId, statusPath, delayMs: result.poll_after_ms ?? 10000 };
}
export async function providerOutputBytes(
  output: z.infer<typeof asset>,
  snapshot: ProviderSnapshot,
  key: string,
  request: typeof fetch = fetch,
) {
  if (output.b64_json) {
    if (
      output.b64_json.length > imageLimits.providerResponseBytes ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(output.b64_json)
    )
      throw new VakvError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
    const bytes = Buffer.from(output.b64_json, "base64");
    if (bytes.length > imageLimits.outputBytes)
      throw new VakvError("PROVIDER_IMAGE_TOO_LARGE", true);
    return bytes;
  }
  const value = output.signed_url ?? output.download_url ?? output.url;
  if (!value) throw new VakvError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  const url = new URL(value, snapshot.origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ![snapshot.origin, ...snapshot.downloadOrigins].includes(url.origin)
  )
    throw new VakvError("PROVIDER_UNTRUSTED_RESULT_URL", true);
  const response = await request(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers:
      url.origin === snapshot.origin && !output.signed_url
        ? { Authorization: `Bearer ${key}` }
        : {},
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new VakvError("PROVIDER_DOWNLOAD_UNAVAILABLE", true);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new VakvError("PROVIDER_EMPTY_IMAGE", true);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > imageLimits.outputBytes) throw new VakvError("PROVIDER_IMAGE_TOO_LARGE", true);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
