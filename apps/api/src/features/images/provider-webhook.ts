import { createHmac, timingSafeEqual } from "node:crypto";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import { imageWebhookSource } from "@lycoboai/generation";
import { Hono } from "hono";
import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
const eventSchema = z
  .object({
    id: identifier,
    object: z.literal("event"),
    type: z.enum(["image.task.completed", "image.task.failed"]),
    data: z.object({
      task: z.object({ task_id: identifier, status: z.enum(["success", "failed", "uncertain"]) }),
    }),
  })
  .refine((event) =>
    event.type === "image.task.completed"
      ? event.data.task.status === "success"
      : event.data.task.status !== "success",
  );
export type WebhookConfig = { secret: string; source: string };
export function readWebhookConfig(env: {
  IMAGE_WEBHOOK_SECRET?: string;
  STANDALONE_IMAGE_API_KEY?: string;
}) {
  if (!env.IMAGE_WEBHOOK_SECRET) return undefined;
  const secret = z.string().min(16).max(256).parse(env.IMAGE_WEBHOOK_SECRET);
  if (!env.STANDALONE_IMAGE_API_KEY) throw new Error("WEBHOOK_KEY_REQUIRED");
  return { secret, source: imageWebhookSource(env.STANDALONE_IMAGE_API_KEY) };
}
export function verifyWebhook(
  body: Uint8Array,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const timestamp = headers.get("X-FluxPort-Webhook-Timestamp") ?? "";
  const signature = headers.get("X-FluxPort-Webhook-Signature") ?? "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^v1=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex"));
}
export function providerWebhookRoutes(deps: {
  config: WebhookConfig;
  repository: Pick<ImageRuntimeRepository, "webhookReceive">;
  wake?: (() => Promise<void>) | undefined;
}) {
  const app = new Hono();
  app.post("/fluxport/images", async (c) => {
    const raw = new Uint8Array(await c.req.arrayBuffer());
    if (!verifyWebhook(raw, c.req.raw.headers, deps.config.secret))
      return c.json({ error: { code: "UNAUTHORIZED", message: "回调签名无效" } }, 401);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(raw));
    } catch {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "回调内容无效" } }, 400);
    }
    const event = eventSchema.safeParse(value);
    if (
      !event.success ||
      c.req.header("X-FluxPort-Event-ID") !== event.data.id ||
      c.req.header("Idempotency-Key") !== event.data.id ||
      c.req.header("X-FluxPort-Event-Type") !== event.data.type
    )
      return c.json({ error: { code: "VALIDATION_ERROR", message: "回调事件无效" } }, 400);
    const ready = await deps.repository.webhookReceive({
      source: deps.config.source,
      eventId: event.data.id,
      eventType: event.data.type,
      taskId: event.data.data.task.task_id,
      taskStatus: event.data.data.task.status,
    });
    // Receipt and outbox are committed before transport. A failed wake is safely retried by
    // provider delivery / foreground recovery / timer; never perform paid work in this route.
    if (ready) await deps.wake?.();
    return c.json({ received: true });
  });
  return app;
}
