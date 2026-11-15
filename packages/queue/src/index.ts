import { z } from "zod";

export const diagnosticJobSchema = z.strictObject({ runId: z.uuid() });
// Transport carries identifiers only. PostgreSQL owns task, attempt and billing state.
export const imageQueueJobSchema = z.strictObject({ version: z.literal(1), itemId: z.uuid() });
export const imageVariantJobSchema = z.strictObject({
  version: z.literal(1),
  assetId: z.uuid(),
  organizationId: z.uuid(),
});
export type ImageQueueJob = z.infer<typeof imageQueueJobSchema>;
export interface ImageQueueSender {
  send(message: ImageQueueJob): Promise<unknown>;
}
export interface OutboxRepository {
  leaseOutbox(
    transport: "queue",
  ): Promise<Array<{ id: string; itemId: string; leaseToken: string }>>;
  ackOutbox(id: string, leaseToken: string): Promise<void>;
}
/** 向持久队列投递已领取的意图，发送成功后才确认租约。 */
export async function dispatchImageOutbox(repository: OutboxRepository, queue: ImageQueueSender) {
  const events = await repository.leaseOutbox("queue");
  let sent = 0;
  for (const event of events) {
    await queue.send(imageQueueJobSchema.parse({ version: 1, itemId: event.itemId }));
    // 发送后确认前中断可能重复投递，由数据库认领阻止重复调用付费模型。
    await repository.ackOutbox(event.id, event.leaseToken);
    sent++;
  }
  return sent;
}

export * from "./realtime";
