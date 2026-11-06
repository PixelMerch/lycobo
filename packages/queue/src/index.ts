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
  leaseOutbox(): Promise<Array<{ id: string; itemId: string; leaseToken: string }>>;
  ackOutbox(id: string, leaseToken: string): Promise<void>;
}
export async function dispatchImageOutbox(repository: OutboxRepository, queue: ImageQueueSender) {
  const events = await repository.leaseOutbox();
  let sent = 0;
  for (const event of events) {
    await queue.send(imageQueueJobSchema.parse({ version: 1, itemId: event.itemId }));
    // A send/ack crash may deliver twice. The database claim prevents duplicate paid calls.
    await repository.ackOutbox(event.id, event.leaseToken);
    sent++;
  }
  return sent;
}

export * from "./realtime";
