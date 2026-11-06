import type { ImageScope, StoredImage } from "@lycoboai/contracts";
import { z } from "zod";
import { type ImageStore, ImageValidationError } from "./core";
import type { ImageObjectBucket } from "./object-bucket";

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

/** Durable R2 intents are only for unpaid uploads. Paid generation keeps its PG outbox. */
export function cloudflareUploads(
  bucket: ImageObjectBucket,
  queue: { send(body: unknown): Promise<unknown> },
  repository: UploadRepository,
  store: ImageStore,
) {
  const write = (intent: UploadIntent) =>
    bucket.put(intentKey(intent.id), new TextEncoder().encode(JSON.stringify(intent)), {
      httpMetadata: { contentType: "application/json" },
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
