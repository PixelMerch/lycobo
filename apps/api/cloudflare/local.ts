import { type LocalQueueBindings, localQueueSender } from "@lycoboai/queue/local";
import api, { type ApiBindings } from "./index";

type LocalBindings = Omit<ApiBindings, "GENERATION_QUEUE"> &
  LocalQueueBindings & { LOCAL_CONSUMER: Fetcher };

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/__local/")) {
      if (request.headers.get("Authorization") !== `Bearer ${env.LOCAL_QUEUE_TOKEN}`)
        return new Response(null, { status: 403 });
      return env.LOCAL_CONSUMER.fetch(request);
    }
    return api.fetch(request, { ...env, GENERATION_QUEUE: localQueueSender(env) }, ctx);
  },
} satisfies ExportedHandler<LocalBindings>;
