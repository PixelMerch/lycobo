import {
  type ImageGenerationInput,
  imageOutputDimensions,
  type ProviderSnapshot,
  providerModelForResolution,
} from "@lycoboai/contracts";
import { normalizeGeminiReply } from "./gemini-protocol";
import { ImageProviderError } from "./provider-errors";
import { referenceType } from "./reference-type";

function referenceUrlMimeType({ pathname }: URL) {
  if (pathname.endsWith(".webp")) return "image/webp";
  return pathname.endsWith(".jpg") ? "image/jpeg" : "image/png";
}

/** SDK-style /v1 base URLs and root origins both resolve to a single API origin. */
export function imageProviderOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageProviderError("INVALID_PROVIDER_URL", false);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/v1", "/v1/"].includes(url.pathname)
  )
    throw new ImageProviderError("INVALID_PROVIDER_URL", false);
  return url.origin;
}
export type ImageProtocolAdapter = {
  acceptsTasks: boolean;
  normalizeReply?: (value: unknown) => unknown;
  prepare: (
    snapshot: ProviderSnapshot,
    input: ImageGenerationInput,
    references: Uint8Array[],
    referenceUrls?: URL[],
  ) => { path?: string; body: string | FormData; headers: Record<string, string> };
};
function fields(snapshot: ProviderSnapshot, input: ImageGenerationInput) {
  const { width, height } = imageOutputDimensions(input.aspectRatio, input.resolution);
  const model = providerModelForResolution(snapshot, input.resolution);
  return {
    model,
    prompt: input.prompt,
    size: `${width}x${height}`,
    n: 1,
    // These Images routes publish no quality enum; do not send GPT defaults to them.
    ...(["grok-imagine-image-2.0", "seedream-5.0-pro"].includes(model)
      ? {}
      : { quality: input.quality ?? "medium" }),
  };
}
export const imageProtocolAdapters: Record<ProviderSnapshot["adapter"], ImageProtocolAdapter> = {
  "openai-images": {
    acceptsTasks: false,
    prepare: (snapshot, input, references) => {
      const payload = { ...fields(snapshot, input), response_format: "b64_json" };
      if (!references.length)
        return { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } };
      const body = new FormData();
      for (const [k, v] of Object.entries(payload)) body.set(k, String(v));
      for (const bytes of references) {
        const type = referenceType(bytes);
        body.append(
          "image[]",
          new Blob([new Uint8Array(bytes)], { type: type.mime }),
          `reference.${type.extension}`,
        );
      }
      return { body, headers: {} };
    },
  },
  "gemini-native": {
    acceptsTasks: true,
    normalizeReply: normalizeGeminiReply,
    prepare: (snapshot, input, references, referenceUrls) => ({
      path: `/v1beta/models/${encodeURIComponent(providerModelForResolution(snapshot, input.resolution))}:generateContent`,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              ...(referenceUrls ?? []).map((url) => ({
                fileData: {
                  fileUri: url.href,
                  mimeType: referenceUrlMimeType(url),
                },
              })),
              ...references.map((bytes) => ({
                inlineData: {
                  mimeType: referenceType(bytes).mime,
                  data: Buffer.from(bytes).toString("base64"),
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: input.aspectRatio,
            imageSize: input.resolution === "1.5K" ? "2K" : input.resolution,
          },
        },
      }),
      headers: { "Content-Type": "application/json" },
    }),
  },
  "fluxport-images": {
    acceptsTasks: true,
    prepare: (snapshot, input, references, referenceUrls) => ({
      body: JSON.stringify({
        ...fields(snapshot, input),
        response_format: "url",
        ...(snapshot.mode === "provider-default"
          ? {}
          : { async: snapshot.mode === "async-preferred" }),
        ...(referenceUrls?.length
          ? { images: referenceUrls.map((url) => ({ image_url: url.href })) }
          : {}),
        ...(references.length
          ? {
              images: references.map((bytes) => ({
                image_url: `data:${referenceType(bytes).mime};base64,${Buffer.from(bytes).toString("base64")}`,
              })),
            }
          : {}),
      }),
      headers: { "Content-Type": "application/json" },
    }),
  },
};
