import type postgres from "postgres";
import { z } from "zod";
import type { ClaimedImage } from "../images/image-repository";

export type ProviderWebhookReceipt = {
  source: string;
  eventId: string;
  taskId: string;
  eventType: "image.task.completed" | "image.task.failed";
  taskStatus: "success" | "failed" | "uncertain";
};
export function providerWebhookRepository(
  call: (operation: string, args: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    webhookReceive: async (receipt: ProviderWebhookReceipt) =>
      z.boolean().parse(await call("receive", receipt)),
    webhookWait: async (
      job: ClaimedImage,
      taskId: string,
      statusPath: string,
      requestId?: string,
    ) =>
      z.boolean().parse(
        await call("wait", {
          source: job.configuredProvider?.snapshot.webhook?.source,
          itemId: job.itemId,
          executionToken: job.executionToken,
          taskId,
          statusPath,
          requestId,
        }),
      ),
    pruneWebhooks: async () => {
      await call("prune", {});
    },
  };
}
export function nativeProviderWebhooks(sql: postgres.Sql) {
  return providerWebhookRepository(async (operation, args) => {
    const [row] =
      await sql`select public.lycobo_provider_webhook(${operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args))))}) result`;
    return row?.result;
  });
}
