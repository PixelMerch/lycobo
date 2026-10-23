import { imageQueueJobSchema } from "@lycoboai/queue";

export async function consumeImageMessages(
  batch: Pick<MessageBatch<unknown>, "messages">,
  process: (itemId: string, deliveryId: string) => Promise<void>,
) {
  for (const message of batch.messages) {
    const payload = imageQueueJobSchema.safeParse(message.body);
    if (!payload.success) {
      console.error("INVALID_QUEUE_MESSAGE");
      message.ack();
      continue;
    }
    try {
      await process(payload.data.itemId, message.id);
      message.ack();
    } catch {
      // The processor must DB-claim every delivery; unknown paid attempts cannot be resubmitted.
      console.error("GENERATION_PROCESSOR_UNAVAILABLE");
      message.retry({ delaySeconds: 30 });
    }
  }
}
