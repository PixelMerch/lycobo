import { execFile } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { assetKeyPattern } from "./asset-delivery";
import type { ImageObjectBucket } from "./object-bucket";

export const videoThumbnailKey = (key: string) => `${key}.thumbnail.webp`;
const run = promisify(execFile);
async function writeChunk(file: Awaited<ReturnType<typeof open>>, bytes: Uint8Array) {
  // FileHandle.write may write fewer bytes than requested.
  let offset = 0;
  while (offset < bytes.length) {
    const written = await file.write(bytes.subarray(offset));
    if (!written.bytesWritten) throw new Error("VIDEO_TEMP_WRITE_FAILED");
    offset += written.bytesWritten;
  }
}

async function writeVideo(input: string, body: ReadableStream<Uint8Array>) {
  const file = await open(input, "wx", 0o600);
  const reader = body.getReader();
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 128 * 1024 * 1024) throw new Error("INVALID_VIDEO_SIZE");
      await writeChunk(file, part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    await file.close();
  }
}

async function generateThumbnail(bucket: ImageObjectBucket, key: string, outputKey: string) {
  if (await bucket.head(outputKey)) return;
  const original = await bucket.get(key);
  if (!original) throw new Error("VIDEO_NOT_FOUND");
  if (!original.size || original.size > 128 * 1024 * 1024) {
    await original.body.cancel();
    throw new Error("INVALID_VIDEO_SIZE");
  }
  const directory = await mkdtemp(join(tmpdir(), "lycobo-video-"));
  try {
    const input = join(directory, "input.mp4");
    const output = join(directory, "cover.webp");
    await writeVideo(input, original.body);
    if (!ffmpegPath) throw new Error("VIDEO_DECODER_UNAVAILABLE");
    await run(
      ffmpegPath,
      [
        "-nostdin",
        "-v",
        "error",
        "-threads",
        "1",
        "-filter_threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "mp4",
        "-ss",
        "0.3",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map_metadata",
        "-1",
        "-frames:v",
        "1",
        "-vf",
        "scale=w='min(480,iw)':h='min(854,ih)':force_original_aspect_ratio=decrease",
        "-c:v",
        "libwebp",
        "-threads",
        "1",
        "-quality",
        "76",
        "-y",
        output,
      ],
      { timeout: 40000, killSignal: "SIGKILL", maxBuffer: 65536 },
    );
    const info = await stat(output);
    if (!info.size || info.size > 2 * 1024 * 1024) throw new Error("INVALID_VIDEO_COVER_SIZE");
    await bucket.put(outputKey, await readFile(output), {
      httpMetadata: { contentType: "image/webp" },
    });
  } catch {
    throw new Error("VIDEO_COVER_UNAVAILABLE");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Decode only private MP4 files, with bounded concurrency, duration, threads and output size. */
export function videoThumbnailCache(bucket: ImageObjectBucket) {
  const pending = new Map<string, Promise<void>>();
  let tail = Promise.resolve();
  return (key: string): Promise<void> => {
    if (!assetKeyPattern.test(key) || !key.endsWith(".mp4"))
      return Promise.reject(new Error("INVALID_VIDEO_KEY"));
    const outputKey = videoThumbnailKey(key);
    const existing = pending.get(outputKey);
    if (existing) return existing;
    if (pending.size >= 8) return Promise.reject(new Error("VIDEO_COVER_BUSY"));
    const work = tail.then(async () => {
      await generateThumbnail(bucket, key, outputKey);
    });
    pending.set(outputKey, work);
    tail = work.catch(() => undefined);
    void work.finally(() => pending.delete(outputKey)).catch(() => undefined);
    return work;
  };
}
