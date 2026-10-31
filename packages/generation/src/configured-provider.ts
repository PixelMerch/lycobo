import { type ImageGenerationInput, imageLimits, type ProviderSnapshot } from "@lycoboai/contracts";
import { z } from "zod";
import { imageProtocolAdapters } from "./provider-adapters";
import { ImageProviderError } from "./provider-errors";

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
  poll_url: z.string().optional(),
});
export class ProviderPollError extends ImageProviderError {
  constructor(
    code: string,
    readonly delayMs: number,
    requestId?: string,
  ) {
    super(code, true, requestId);
  }
}
export type ProviderResult =
  | { kind: "complete"; outputs: z.infer<typeof asset>[]; requestId?: string | undefined }
  | {
      kind: "pending";
      taskId: string;
      statusPath: string;
      delayMs: number;
      requestId?: string | undefined;
    };
export function providerTaskPath(value: string, origin: string) {
  const url = new URL(value, origin);
  if (
    url.origin !== new URL(origin).origin ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1/images/tasks/")
  )
    throw new ImageProviderError("PROVIDER_UNTRUSTED_TASK_URL", true);
  return url.pathname + url.search;
}
async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ImageProviderError("PROVIDER_EMPTY_RESPONSE", true);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > imageLimits.providerResponseBytes)
        throw new ImageProviderError("PROVIDER_RESPONSE_TOO_LARGE", true);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
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
  let submissionPath: string | undefined;
  const adapter = imageProtocolAdapters[snapshot.adapter];
  if (!isPoll) {
    headers["Idempotency-Key"] = idempotencyKey;
    const prepared = adapter.prepare(snapshot, input, references);
    body = prepared.body;
    submissionPath = prepared.path;
    Object.assign(headers, prepared.headers);
  }
  const path = pending
    ? providerTaskPath(pending.statusPath, snapshot.origin)
    : (submissionPath ?? (references.length ? "/v1/images/edits" : "/v1/images/generations"));
  const response = await request(new URL(path, snapshot.origin), {
    method: isPoll ? "GET" : "POST",
    headers,
    ...(body ? { body } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(isPoll ? 30000 : snapshot.timeoutMs),
  });
  const rawRequestId = response.headers.get("x-request-id");
  const requestId =
    rawRequestId && /^[\w.:/-]{1,200}$/.test(rawRequestId) ? rawRequestId : undefined;
  if (
    isPoll &&
    (["stop"].includes(response.headers.get("X-FluxPort-Poll-Action") ?? "") ||
      [401, 403, 404, 410].includes(response.status))
  ) {
    await response.body?.cancel();
    throw new ImageProviderError("PROVIDER_POLL_STOPPED", true, requestId);
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
        requestId,
      );
    }
    throw new ImageProviderError(
      `PROVIDER_HTTP_${response.status}`,
      isPoll || ![400, 401, 403, 404, 413, 415, 422, 429].includes(response.status),
      requestId,
    );
  }
  let json: unknown;
  try {
    json = await readJson(response);
    if (adapter.normalizeReply) json = adapter.normalizeReply(json);
  } catch (error) {
    throw new ImageProviderError(
      error instanceof ImageProviderError ? error.code : "PROVIDER_RESPONSE_UNAVAILABLE",
      true,
      requestId,
    );
  }
  const parsed = reply.safeParse(json);
  if (!parsed.success)
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true, requestId);
  const result = parsed.data;
  if (result.status === "failed")
    throw new ImageProviderError("PROVIDER_TASK_FAILED", false, requestId);
  const direct =
    result.data?.filter(
      (output) => output.url || output.b64_json || output.signed_url || output.download_url,
    ) ?? [];
  const outputs = direct.length
    ? direct
    : (result.assets ?? []).filter(
        (output) => output.url || output.b64_json || output.signed_url || output.download_url,
      );
  if (outputs.length && (!result.status || ["success", "succeeded"].includes(result.status)))
    return { kind: "complete", outputs, requestId };
  // retryable controls new submissions, not reads of an already accepted task.
  // Completed summary receipts can stop auto-polling while still needing a result fetch.
  if (
    ["uncertain", "client_disconnected", "paused", "canceled"].includes(result.status ?? "") ||
    (result.auto_poll === false && !["success", "succeeded"].includes(result.status ?? ""))
  )
    throw new ImageProviderError("PROVIDER_OUTCOME_UNKNOWN", true, requestId);
  const taskId = result.task_id ?? pending?.taskId;
  if (!adapter.acceptsTasks || !taskId)
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  let statusPath = providerTaskPath(
    result.status_url ??
      result.poll_url ??
      pending?.statusPath ??
      `/v1/images/tasks/${encodeURIComponent(taskId)}?view=summary`,
    snapshot.origin,
  );
  if (result.status === "success" || result.status === "succeeded") {
    const full = new URL(result.result_url ?? statusPath, snapshot.origin);
    full.searchParams.delete("view");
    statusPath = providerTaskPath(full.href, snapshot.origin);
  }
  return { kind: "pending", taskId, statusPath, delayMs: result.poll_after_ms ?? 2000, requestId };
}
function decodeImageBase64(value: string) {
  if (value.length > imageLimits.providerResponseBytes || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, ""))
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  if (bytes.length > imageLimits.outputBytes)
    throw new ImageProviderError("PROVIDER_IMAGE_TOO_LARGE", true);
  return bytes;
}
export async function providerOutputBytes(
  output: z.infer<typeof asset>,
  snapshot: ProviderSnapshot,
  key: string,
  request: typeof fetch = fetch,
) {
  if (output.b64_json) return decodeImageBase64(output.b64_json);
  const providerOrigin = new URL(snapshot.origin).origin;
  const allowedOrigins = [
    providerOrigin,
    ...snapshot.downloadOrigins.map((origin) => new URL(origin).origin),
  ];
  const candidates = [
    { value: output.signed_url, signed: true },
    { value: output.download_url, signed: false },
    { value: output.url, signed: false },
  ].filter((item): item is { value: string; signed: boolean } => !!item.value);
  if (!candidates.length) throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  let last: unknown = new ImageProviderError("PROVIDER_DOWNLOAD_UNAVAILABLE", true);
  for (const candidate of candidates) {
    try {
      if (candidate.value.startsWith("data:")) {
        const data = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          candidate.value,
        );
        if (!data?.[1]) throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
        return decodeImageBase64(data[1]);
      }
      const url = new URL(candidate.value, snapshot.origin);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !allowedOrigins.includes(url.origin)
      )
        throw new ImageProviderError("PROVIDER_UNTRUSTED_RESULT_URL", true);
      const response = await request(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
        headers:
          url.origin === providerOrigin && !candidate.signed
            ? { Authorization: `Bearer ${key}` }
            : {},
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ImageProviderError("PROVIDER_DOWNLOAD_UNAVAILABLE", true);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new ImageProviderError("PROVIDER_EMPTY_IMAGE", true);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > imageLimits.outputBytes)
            throw new ImageProviderError("PROVIDER_IMAGE_TOO_LARGE", true);
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (!size) throw new ImageProviderError("PROVIDER_EMPTY_IMAGE", true);
      return Buffer.concat(chunks);
    } catch (error) {
      last = error;
      if (!candidate.signed) throw error;
    }
  }
  throw last;
}
