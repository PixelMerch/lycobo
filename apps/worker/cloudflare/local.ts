import { imageQueueJobSchema } from "@lycoboai/queue";
import { type LocalQueueBindings, localQueueSender } from "@lycoboai/queue/local";
import consumer, { type GenerationBindings, processGenerationBatch } from "./index";

type LocalBindings = Omit<GenerationBindings, "GENERATION_QUEUE"> & LocalQueueBindings;

export default {
  async fetch(request, env) {
    if (
      request.method !== "POST" ||
      request.headers.get("Authorization") !== `Bearer ${env.LOCAL_QUEUE_TOKEN}`
    )
      return new Response(null, { status: 403 });
    const bindings = { ...env, GENERATION_QUEUE: localQueueSender(env) };
    try {
      if (new URL(request.url).pathname === "/__local/maintenance") {
        await consumer.scheduled(
          { scheduledTime: Date.now(), cron: "* * * * *", noRetry() {} },
          bindings,
        );
        return new Response(null, { status: 204 });
      }
      if (new URL(request.url).pathname !== "/__local/consume")
        return new Response(null, { status: 404 });
      const body = imageQueueJobSchema.safeParse(await request.json());
      if (!body.success) return new Response(null, { status: 400 });
      let retry = false;
      await processGenerationBatch(
        {
          messages: [
            {
              id: request.headers.get("X-Delivery-Id") ?? crypto.randomUUID(),
              timestamp: new Date(),
              body: body.data,
              attempts: 1,
              ack() {},
              retry() {
                retry = true;
              },
            },
          ],
        },
        bindings,
      );
      return new Response(null, { status: retry ? 503 : 204 });
    } catch {
      console.error("LOCAL_CONSUMER_UNAVAILABLE");
      return new Response(null, { status: 503 });
    }
  },
} satisfies ExportedHandler<LocalBindings>;
