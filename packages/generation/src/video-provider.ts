import { type VideoInput, videoInputSchema, videoModel } from "@lycoboai/contracts";
import { z } from "zod";

export const videoOutputLimit = 128 * 1024 * 1024;
export class VideoProviderError extends Error {
  constructor(
    readonly code: string,
    readonly uncertain = true,
  ) {
    super(code);
  }
}
export function videoConfiguration(env: {
  STANDALONE_IMAGE_API_KEY?: string;
  VIDEO_API_ORIGIN?: string;
}) {
  if (!env.STANDALONE_IMAGE_API_KEY) return null;
  const origin = env.VIDEO_API_ORIGIN ?? "https://api.uselg.top";
  if (!["https://api.uselg.top", "https://api.ai-media.vip"].includes(origin))
    throw new Error("VIDEO_ORIGIN_INVALID");
  return { origin, key: env.STANDALONE_IMAGE_API_KEY };
}
const providerTaskSchema = z.object({
  id: z.string().regex(/^[\w-]{1,200}$/),
  status: z.enum([
    "queued",
    "in_progress",
    "paused",
    "pending_confirmation",
    "completed",
    "failed",
    "canceled",
  ]),
  poll_after_ms: z.number().nonnegative().optional(),
  video_available: z.boolean().optional(),
});
export type ProviderVideoTask = z.infer<typeof providerTaskSchema>;
export async function callVideoProvider(
  config: { origin: string; key: string },
  taskId?: string,
  creation?: { input: VideoInput; images: string[]; key: string },
  request: typeof fetch = fetch,
): Promise<ProviderVideoTask> {
  if (
    !config.origin ||
    !["https://api.uselg.top", "https://api.ai-media.vip"].includes(config.origin)
  )
    throw new VideoProviderError("VIDEO_ORIGIN_INVALID", false);
  if (taskId && !/^[\w-]{1,200}$/.test(taskId)) throw new VideoProviderError("VIDEO_TASK_INVALID");
  if (!taskId && !creation) throw new VideoProviderError("VIDEO_INPUT_INVALID", false);
  const input = creation ? videoInputSchema.parse(creation.input) : undefined;
  try {
    const response = await request(`${config.origin}/v1/videos${taskId ? `/${taskId}` : ""}`, {
      method: taskId ? "GET" : "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
      headers: {
        Authorization: `Bearer ${config.key}`,
        ...(creation
          ? { "Content-Type": "application/json", "Idempotency-Key": creation.key }
          : {}),
      },
      ...(creation && input
        ? {
            body: JSON.stringify({
              model: videoModel,
              prompt: input.prompt.replace(/@图片(\d+)/g, "图$1"),
              seconds: input.seconds,
              aspect_ratio: input.aspectRatio,
              ...(creation.images.length ? { images: creation.images } : {}),
            }),
          }
        : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new VideoProviderError(
        "VIDEO_PROVIDER_REJECTED",
        !!taskId || ![400, 401, 403, 422, 429].includes(response.status),
      );
    }
    const text = await readVideoResponse(response, 1024 * 1024);
    return providerTaskSchema.parse(JSON.parse(new TextDecoder().decode(text)));
  } catch (error) {
    if (error instanceof VideoProviderError) throw error;
    throw new VideoProviderError("VIDEO_PROVIDER_UNAVAILABLE");
  }
}
export async function readVideoResponse(response: Response, limit = videoOutputLimit) {
  if (Number(response.headers.get("Content-Length")) > limit) {
    await response.body?.cancel();
    throw new VideoProviderError("VIDEO_OUTPUT_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new VideoProviderError("VIDEO_EMPTY_OUTPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw new VideoProviderError("VIDEO_OUTPUT_TOO_LARGE");
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
export async function downloadProviderVideo(
  config: { origin: string; key: string },
  id: string,
  request: typeof fetch = fetch,
) {
  if (!/^[\w-]{1,200}$/.test(id)) throw new VideoProviderError("VIDEO_TASK_INVALID");
  let url = new URL(`/v1/videos/${id}/content`, config.origin);
  // Only documented media hosts; external redirects never receive the API key.
  const allowed = new Set([
    "https://api.uselg.top",
    "https://api.ai-media.vip",
    "https://download.ai-media.vip",
  ]);
  for (let count = 0; count < 4; count++) {
    if (!allowed.has(url.origin) || url.username || url.password)
      throw new VideoProviderError("VIDEO_DOWNLOAD_ORIGIN_INVALID");
    const response = await request(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(90000),
      headers: url.origin === config.origin ? { Authorization: `Bearer ${config.key}` } : {},
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      await response.body?.cancel();
      if (!location) throw new VideoProviderError("VIDEO_DOWNLOAD_INVALID");
      url = new URL(location, url);
      continue;
    }
    if (
      !response.ok ||
      !/^(video\/mp4|application\/octet-stream)(;|$)/i.test(
        response.headers.get("Content-Type") ?? "",
      )
    ) {
      await response.body?.cancel();
      throw new VideoProviderError("VIDEO_DOWNLOAD_UNAVAILABLE");
    }
    return readVideoResponse(response);
  }
  throw new VideoProviderError("VIDEO_DOWNLOAD_REDIRECT_LIMIT");
}
