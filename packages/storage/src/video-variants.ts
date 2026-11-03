import { execFile } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { assetKeyPattern } from "./asset-delivery";
import type { ImageObjectBucket } from "./object-bucket";

export type VideoVariant = "preview" | "thumbnail";
export const videoVariantKey = (key: string, variant: VideoVariant) =>
  `${key}.${variant}.${variant === "thumbnail" ? "webp" : "mp4"}`;
const run = promisify(execFile);
/** Decode only private MP4 files, with bounded concurrency, duration, threads and output size. */
export function videoVariantCache(bucket: ImageObjectBucket) {
  const pending = new Map<string, Promise<void>>();
  let tail = Promise.resolve();
  return (key: string, variant: VideoVariant): Promise<void> => {
    if (!assetKeyPattern.test(key) || !key.endsWith(".mp4"))
      return Promise.reject(new Error("INVALID_VIDEO_KEY"));
    const outputKey = videoVariantKey(key, variant);
    const existing = pending.get(outputKey);
    if (existing) return existing;
    if (pending.size >= 8) return Promise.reject(new Error("VIDEO_PREVIEW_BUSY"));
    const work = tail.then(async () => {
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
        const output = join(directory, variant === "thumbnail" ? "cover.webp" : "preview.mp4");
        const file = await open(input, "wx", 0o600);
        const reader = original.body.getReader();
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > 128 * 1024 * 1024) throw new Error("INVALID_VIDEO_SIZE");
            // FileHandle.write may write fewer bytes than requested.
            let offset = 0;
            while (offset < part.value.length) {
              const written = await file.write(part.value.subarray(offset));
              if (!written.bytesWritten) throw new Error("VIDEO_TEMP_WRITE_FAILED");
              offset += written.bytesWritten;
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
          await file.close();
        }
        if (!ffmpegPath) throw new Error("VIDEO_DECODER_UNAVAILABLE");
        const arguments_ = [
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
        ];
        if (variant === "thumbnail") arguments_.push("-ss", "0.3");
        arguments_.push("-i", input, "-map", "0:v:0", "-map_metadata", "-1");
        if (variant === "thumbnail")
          arguments_.push(
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
          );
        else
          arguments_.push(
            "-map",
            "0:a?",
            "-t",
            "30",
            "-vf",
            "scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=20",
            "-c:v",
            "libx264",
            "-threads",
            "1",
            "-preset",
            "veryfast",
            "-crf",
            "30",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "64k",
            "-movflags",
            "+faststart",
            "-fs",
            String(24 * 1024 * 1024),
          );
        arguments_.push("-y", output);
        await run(ffmpegPath, arguments_, {
          timeout: 40000,
          killSignal: "SIGKILL",
          maxBuffer: 65536,
        });
        const info = await stat(output);
        if (!info.size || info.size > (variant === "thumbnail" ? 2 : 24) * 1024 * 1024)
          throw new Error("INVALID_VIDEO_VARIANT_SIZE");
        await bucket.put(outputKey, await readFile(output), {
          httpMetadata: { contentType: variant === "thumbnail" ? "image/webp" : "video/mp4" },
        });
      } catch {
        throw new Error("VIDEO_PREVIEW_UNAVAILABLE");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
    pending.set(outputKey, work);
    tail = work.catch(() => {});
    void work.finally(() => pending.delete(outputKey)).catch(() => {});
    return work;
  };
}
