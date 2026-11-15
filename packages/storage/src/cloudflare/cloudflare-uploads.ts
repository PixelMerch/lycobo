import type { R2ListOptions, R2Object } from "@cloudflare/workers-types";
import type { ImageScope, StoredImage } from "@lycoboai/contracts";
import { z } from "zod";
import type { ImageObjectBucket } from "../buckets/object-bucket";
import { type ImageStore, ImageValidationError } from "../images/core";

export const uploadJobSchema = z.strictObject({ version: z.literal(1), uploadId: z.uuid() });
const uploadIntentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  organizationId: z.uuid(),
  expiresAt: z.number(),
  status: z.enum(["pending", "succeeded", "failed"]),
});
type UploadIntent = z.infer<typeof uploadIntentSchema>;
const intentKey = (id: string) => `_uploads/${z.uuid().parse(id)}.json`;
const rawKey = (id: string) => `_uploads/${z.uuid().parse(id)}.bin`;
type UploadRepository = {
  asset(scope: ImageScope, id: string): Promise<StoredImage | null>;
  addReference(scope: ImageScope, image: StoredImage): Promise<void>;
};
type UploadRecoveryBucket = {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  list(
    options: R2ListOptions,
  ): Promise<
    { objects: Pick<R2Object, "key" | "uploaded" | "customMetadata">[] } & (
      | { truncated: true; cursor: string }
      | { truncated: false }
    )
  >;
  put(key: string, cursor: string): Promise<unknown>;
  delete(key: string): Promise<void>;
};

function isCurrentTerminalReceipt(metadata: R2Object["customMetadata"], now: number) {
  const { status, expiresAt } = metadata ?? {};
  return (status === "succeeded" || status === "failed") && Number(expiresAt) > now;
}

/** 从 R2 列表恢复待处理上传并清理到期意图，旧回执沿用正文检查。 */
export async function recoverCloudflareUploads(
  bucket: UploadRecoveryBucket,
  recover: (id: string) => Promise<void>,
) {
  const cursorKey = "_upload-scan-cursor";
  const stored = await bucket.get(cursorKey);
  const cursor = stored ? await stored.text() : undefined;
  const page = await bucket.list({
    prefix: "_uploads/",
    limit: 100,
    include: ["customMetadata"],
    ...(cursor ? { cursor } : {}),
  });
  const now = Date.now();
  for (const object of page.objects) {
    if (object.key.endsWith(".bin") && object.uploaded.getTime() < now - 86400000) {
      await bucket.delete(object.key);
      continue;
    }
    if (!object.key.endsWith(".json")) continue;
    // 已完成且未到期的回执供用户确认，无须每分钟再读取一次正文。
    if (isCurrentTerminalReceipt(object.customMetadata, now)) continue;
    const id = z.uuid().safeParse(object.key.slice("_uploads/".length, -".json".length));
    if (id.success) await recover(id.data);
  }
  if (page.truncated) await bucket.put(cursorKey, page.cursor);
  else if (stored) await bucket.delete(cursorKey);
}

/** 使用 R2 保存免费参考图上传意图，付费生图继续使用 PostgreSQL outbox。 */
export function cloudflareUploads(
  bucket: ImageObjectBucket,
  queue: { send(body: unknown): Promise<unknown> },
  repository: UploadRepository,
  store: ImageStore,
) {
  const write = (intent: UploadIntent) =>
    bucket.put(intentKey(intent.id), new TextEncoder().encode(JSON.stringify(intent)), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { status: intent.status, expiresAt: String(intent.expiresAt) },
    });
  async function read(id: string) {
    const object = await bucket.get(intentKey(id));
    if (!object || object.size > 4096) return null;
    return uploadIntentSchema.parse(
      JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),
    );
  }
  async function send(id: string) {
    await queue.send(uploadJobSchema.parse({ version: 1, uploadId: id }));
  }
  return {
    async enqueue(scope: ImageScope, bytes: Uint8Array) {
      const id = crypto.randomUUID();
      await bucket.put(rawKey(id), bytes, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      await write({ ...scope, id, status: "pending", expiresAt: Date.now() + 86400000 });
      try {
        await send(id);
      } catch {
        console.error("UPLOAD_QUEUE_SEND_FAILED", id);
      }
      return id;
    },
    async status(scope: ImageScope, id: string) {
      const intent = await read(id);
      if (
        !intent ||
        intent.expiresAt <= Date.now() ||
        intent.userId !== scope.userId ||
        intent.organizationId !== scope.organizationId
      )
        return null;
      if (intent.status !== "succeeded") return { status: intent.status };
      const image = await repository.asset(scope, id);
      return image ? { status: "succeeded" as const, image } : null;
    },
    async process(id: string) {
      const intent = await read(id);
      if (!intent || intent.expiresAt <= Date.now() || intent.status !== "pending") return;
      const existing = await repository.asset(intent, id);
      if (existing) {
        await write({ ...intent, status: "succeeded" });
        await bucket.delete(rawKey(id));
        return;
      }
      const raw = await bucket.get(rawKey(id));
      if (!raw || raw.size > 10 * 1024 * 1024) throw new Error("UPLOAD_SOURCE_UNAVAILABLE");
      try {
        const bytes = new Uint8Array(await raw.arrayBuffer());
        const prepared = store.prepareReferenceUpload
          ? await store.prepareReferenceUpload(bytes)
          : bytes;
        const image = await store.put(intent, prepared, id);
        await repository.addReference(intent, image);
        await write({ ...intent, status: "succeeded" });
        await bucket.delete(rawKey(id));
      } catch (error) {
        if (!(error instanceof ImageValidationError)) throw error;
        await write({ ...intent, status: "failed" });
        await bucket.delete(rawKey(id));
      }
    },
    async recover(id: string) {
      const intent = await read(id);
      if (!intent) return;
      if (intent.expiresAt <= Date.now()) {
        await bucket.delete([rawKey(id), intentKey(id)]);
        return;
      }
      if (intent.status === "pending") await send(id);
    },
  };
}
