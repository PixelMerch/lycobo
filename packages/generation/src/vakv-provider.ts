import type { ImageGenerationInput, ImageResolution } from "@lycoboai/contracts";
import {
  imageLimits,
  imageModelCatalog,
  imageModelIds,
  imageProviderModel,
  imageResolutionSchema,
  imageUnitCredits,
  publicImageModel,
} from "@lycoboai/contracts";
import { z } from "zod";

export const capabilityOverridesSchema = z.partialRecord(
  z.enum(imageModelIds),
  z.array(imageResolutionSchema).min(1).max(3),
);
export type CapabilityOverrides = z.infer<typeof capabilityOverridesSchema>;
export function supportedResolutions(
  model: ImageGenerationInput["model"],
  _overrides: CapabilityOverrides = {},
) {
  // Public models route to the appropriate provider channel for each resolution.
  return imageModelCatalog.find((m) => m.id === publicImageModel(model))?.allowedResolutions ?? [];
}
export function validateModelInput(
  input: ImageGenerationInput,
  overrides: CapabilityOverrides = {},
  editsEnabled = false,
) {
  if (!supportedResolutions(input.model, overrides).includes(input.resolution))
    throw new VakvError("MODEL_RESOLUTION_UNVERIFIED", false);
  if (input.referenceAssetIds.length && !editsEnabled)
    throw new VakvError("IMAGE_EDITS_NOT_VERIFIED", false);
}
export function imageDimensions(ratio: string, resolution: ImageResolution) {
  const [w, h] = ratio.split(":").map(Number);
  const edge = { "1K": 1024, "2K": 2048, "4K": 4096 }[resolution];
  const scale = edge / Math.max(w ?? 1, h ?? 1);
  return {
    width: Math.round(((w ?? 1) * scale) / 16) * 16,
    height: Math.round(((h ?? 1) * scale) / 16) * 16,
  };
}
export class VakvError extends Error {
  constructor(
    readonly code: string,
    readonly unknownOutcome: boolean,
    readonly requestId?: string | undefined,
  ) {
    super(code);
  }
}
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).length(1),
});
export type GenerationTiming = {
  stage: string;
  durationMs: number;
  bytes?: number;
  status?: number;
};
// Observability must never change paid-request outcomes or expose payloads.
export function reportGenerationTiming(
  report: ((event: GenerationTiming) => void) | undefined,
  event: GenerationTiming,
) {
  try {
    report?.(event);
  } catch {
    // A failing telemetry sink must not trigger a retry or discard a generated image.
  }
}
export type VakvConfig = {
  key: string;
  baseUrl: string;
  timeoutMs: number;
  allowHttpForTests?: boolean;
  onTiming?: (event: GenerationTiming) => void;
};
export async function generateVakvImage(
  input: ImageGenerationInput,
  references: Uint8Array[],
  config: VakvConfig,
  idempotencyKey: string,
  request: typeof fetch = fetch,
  providerModel = imageProviderModel(input),
): Promise<{ bytes: Buffer; requestId?: string | undefined }> {
  const url = new URL(config.baseUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new VakvError("INVALID_PROVIDER_URL", false);
  if (
    url.protocol !== "https:" &&
    !(
      config.allowHttpForTests &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new VakvError("INVALID_PROVIDER_URL", false);
  const dimensions = imageDimensions(input.aspectRatio, input.resolution);
  const size = `${dimensions.width}x${dimensions.height}`;
  let requestId: string | undefined;
  let body: FormData | string;
  if (references.length) {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      model: providerModel,
      prompt: input.prompt,
      size,
      n: "1",
      response_format: "b64_json",
      quality: input.quality ?? "medium",
    }))
      form.set(key, value);
    for (const bytes of references)
      form.append(
        "image[]",
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        "reference.png",
      );
    body = form;
  } else
    body = JSON.stringify({
      model: providerModel,
      prompt: input.prompt,
      n: 1,
      size,
      response_format: "b64_json",
      quality: input.quality ?? "medium",
    });
  const started = performance.now();
  const timing = (stage: string, since: number, extra: { bytes?: number; status?: number } = {}) =>
    reportGenerationTiming(config.onTiming, {
      stage,
      durationMs: Math.round(performance.now() - since),
      ...extra,
    });
  timing("provider_request_started", started);
  try {
    const response = await request(
      new URL(references.length ? "/v1/images/edits" : "/v1/images/generations", url),
      {
        method: "POST",
        // Workers does not implement redirect:error. Never follow a provider redirect with credentials.
        redirect: "manual",
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Idempotency-Key": idempotencyKey,
          ...(!references.length ? { "Content-Type": "application/json" } : {}),
        },
        body,
      },
    );
    timing("provider_headers", started, { status: response.status });
    const bodyStarted = performance.now();
    const header =
      response.headers.get("x-request-id") ?? response.headers.get("x-oneapi-request-id");
    if (header && /^[\w-]{1,200}$/.test(header)) requestId = header;
    if (!response.ok) {
      await response.body?.cancel();
      const definite = [400, 401, 403, 404, 413, 415, 422, 429].includes(response.status);
      throw new VakvError(`PROVIDER_HTTP_${response.status}`, !definite, requestId);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new VakvError("PROVIDER_EMPTY_RESPONSE", true, requestId);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > imageLimits.providerResponseBytes)
          throw new VakvError("PROVIDER_RESPONSE_TOO_LARGE", true, requestId);
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    timing("provider_body", bodyStarted, { bytes: length });
    const decodeStarted = performance.now();
    const parsed = responseSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      timing("provider_invalid_response_shape", decodeStarted);
      throw new VakvError("PROVIDER_INVALID_IMAGE_RESPONSE", true, requestId);
    }
    const encoded = parsed.data.data[0]?.b64_json ?? "";
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      timing("provider_invalid_base64", decodeStarted);
      throw new VakvError("PROVIDER_INVALID_IMAGE_RESPONSE", true, requestId);
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > imageLimits.outputBytes)
      throw new VakvError("PROVIDER_IMAGE_TOO_LARGE", true, requestId);
    timing("provider_decode", decodeStarted, { bytes: bytes.length });
    timing("provider_complete", started);
    return { bytes, requestId };
  } catch (error) {
    timing("provider_error", started);
    if (error instanceof VakvError) throw error;
    // Transport errors, malformed successful responses and timeouts may already have been billed.
    throw new VakvError("PROVIDER_OUTCOME_UNKNOWN", true, requestId);
  }
}

export function readImagePolicy(input: Record<string, string | undefined>) {
  const parsed = z
    .object({
      IMAGE_GENERATION_ENABLED: z.enum(["true", "false"]).default("false"),
      VAKV_ENABLE_IMAGE_EDITS: z.enum(["true", "false"]).default("false"),
      IMAGE_CREDITS_PER_IMAGE: z.coerce.number().int().min(1).max(1000000).default(20),
    })
    .safeParse(input);
  let overrides: CapabilityOverrides;
  try {
    overrides = capabilityOverridesSchema.parse(
      JSON.parse(input.VAKV_CAPABILITY_OVERRIDES ?? "{}"),
    );
  } catch {
    throw new Error("Invalid VAKV_CAPABILITY_OVERRIDES");
  }
  if (!parsed.success) throw new Error("Invalid image generation policy");
  return {
    enabled: parsed.data.IMAGE_GENERATION_ENABLED === "true",
    editsEnabled: parsed.data.VAKV_ENABLE_IMAGE_EDITS === "true",
    unitCredits: imageUnitCredits,
    overrides,
  };
}
