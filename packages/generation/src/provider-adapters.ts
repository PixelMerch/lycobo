import type { ImageGenerationInput, ProviderSnapshot } from "@lycoboai/contracts";
import { ImageProviderError } from "./provider-errors";

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
  prepare: (
    snapshot: ProviderSnapshot,
    input: ImageGenerationInput,
    references: Uint8Array[],
  ) => { body: string | FormData; headers: Record<string, string> };
};
function fields(snapshot: ProviderSnapshot, input: ImageGenerationInput) {
  const [w, h] = input.aspectRatio.split(":").map(Number);
  const edge = { "1K": 1024, "2K": 2048, "4K": 4096 }[input.resolution];
  const scale = edge / Math.max(w ?? 1, h ?? 1);
  return {
    model: snapshot.upstreamModel,
    prompt: input.prompt,
    size: `${Math.round(((w ?? 1) * scale) / 16) * 16}x${Math.round(((h ?? 1) * scale) / 16) * 16}`,
    n: 1,
    quality: input.quality ?? "medium",
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
      for (const bytes of references)
        body.append(
          "image[]",
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          "reference.png",
        );
      return { body, headers: {} };
    },
  },
  "fluxport-images": {
    acceptsTasks: true,
    prepare: (snapshot, input, references) => ({
      body: JSON.stringify({
        ...fields(snapshot, input),
        response_format: "url",
        ...(snapshot.mode === "provider-default"
          ? {}
          : { async: snapshot.mode === "async-preferred" }),
        ...(references.length
          ? {
              images: references.map((bytes) => ({
                image_url: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
              })),
            }
          : {}),
      }),
      headers: { "Content-Type": "application/json" },
    }),
  },
};
