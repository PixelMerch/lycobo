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
    await reader.cancel().catch(() => undefined);
  }
  try {
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return payload;
  } catch {
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  }
}
type PendingProviderTask = { taskId: string; statusPath: string };

function retryDelay(retryAfter: string | null) {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  let delay = 0;
  if (Number.isFinite(seconds)) delay = seconds * 1000;
  else if (retryAfter) delay = Date.parse(retryAfter) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

async function assertProviderResponse(
  response: Response,
  isPoll: boolean,
  requestId: string | undefined,
) {
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
      const delay = retryDelay(response.headers.get("Retry-After"));
      throw new ProviderPollError(`PROVIDER_HTTP_${response.status}`, delay, requestId);
    }
    throw new ImageProviderError(
      `PROVIDER_HTTP_${response.status}`,
      isPoll || ![400, 401, 403, 404, 413, 415, 422, 429].includes(response.status),
      requestId,
    );
  }
}

async function readProviderReply(
  response: Response,
  adapter: (typeof imageProtocolAdapters)[ProviderSnapshot["adapter"]],
  requestId: string | undefined,
) {
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
  return parsed.data;
}

export async function configuredProviderCall(
  snapshot: ProviderSnapshot,
  key: string,
  input: ImageGenerationInput,
  references: Uint8Array[],
  idempotencyKey: string,
  pending?: PendingProviderTask,
  request: typeof fetch = fetch,
  referenceUrls?: URL[],
): Promise<ProviderResult> {
  const isPoll = !!pending;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let body: FormData | string | undefined;
  let submissionPath: string | undefined;
  const adapter = imageProtocolAdapters[snapshot.adapter];
  if (!isPoll) {
    if (referenceUrls?.length && (snapshot.adapter === "openai-images" || references.length))
      throw new ImageProviderError("INVALID_PROVIDER_REFERENCE_TRANSPORT", false);
    headers["Idempotency-Key"] = idempotencyKey;
    const prepared = adapter.prepare(snapshot, input, references, referenceUrls);
    body = prepared.body;
    submissionPath = prepared.path;
    Object.assign(headers, prepared.headers);
  }
  const path = pending
    ? providerTaskPath(pending.statusPath, snapshot.origin)
    : (submissionPath ??
      (references.length || referenceUrls?.length ? "/v1/images/edits" : "/v1/images/generations"));
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
  await assertProviderResponse(response, isPoll, requestId);
  const result = await readProviderReply(response, adapter, requestId);
  return providerResult(result, snapshot, adapter.acceptsTasks, pending, requestId);
}
function providerOutputs(result: z.infer<typeof reply>) {
  const direct =
    result.data?.filter(
      (output) => output.url || output.b64_json || output.signed_url || output.download_url,
    ) ?? [];
  return direct.length
    ? direct
    : (result.assets ?? []).filter(
        (output) => output.url || output.b64_json || output.signed_url || output.download_url,
      );
}

function providerResult(
  result: z.infer<typeof reply>,
  snapshot: ProviderSnapshot,
  acceptsTasks: boolean,
  pending: PendingProviderTask | undefined,
  requestId: string | undefined,
): ProviderResult {
  if (result.status === "failed")
    throw new ImageProviderError("PROVIDER_TASK_FAILED", false, requestId);
  const outputs = providerOutputs(result);
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
  if (!acceptsTasks || !taskId)
    throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
  const statusPath = resultStatusPath(result, snapshot.origin, pending, taskId);
  return { kind: "pending", taskId, statusPath, delayMs: result.poll_after_ms ?? 2000, requestId };
}
function resultStatusPath(
  result: z.infer<typeof reply>,
  origin: string,
  pending: PendingProviderTask | undefined,
  taskId: string,
) {
  let statusPath = providerTaskPath(
    result.status_url ??
      result.poll_url ??
      pending?.statusPath ??
      `/v1/images/tasks/${encodeURIComponent(taskId)}?view=summary`,
    origin,
  );
  if (result.status === "success" || result.status === "succeeded") {
    const full = new URL(result.result_url ?? statusPath, origin);
    full.searchParams.delete("view");
    statusPath = providerTaskPath(full.href, origin);
  }
  return statusPath;
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
      return await downloadImageCandidate(
        candidate,
        snapshot.origin,
        providerOrigin,
        allowedOrigins,
        key,
        request,
      );
    } catch (error) {
      last = error;
      if (!candidate.signed) throw error;
    }
  }
  throw last;
}

async function downloadImageCandidate(
  candidate: { value: string; signed: boolean },
  origin: string,
  providerOrigin: string,
  allowedOrigins: string[],
  key: string,
  request: typeof fetch,
) {
  if (candidate.value.startsWith("data:")) {
    const data = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(candidate.value);
    if (!data?.[1]) throw new ImageProviderError("PROVIDER_UNRECOGNIZED_RESPONSE", true);
    return decodeImageBase64(data[1]);
  }
  const url = new URL(candidate.value, origin);
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
      url.origin === providerOrigin && !candidate.signed ? { Authorization: `Bearer ${key}` } : {},
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ImageProviderError("PROVIDER_DOWNLOAD_UNAVAILABLE", true);
  }
  return readImageBytes(response);
}

async function readImageBytes(response: Response) {
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
    await reader.cancel().catch(() => undefined);
  }
  if (!size) throw new ImageProviderError("PROVIDER_EMPTY_IMAGE", true);
  return Buffer.concat(chunks);
}
