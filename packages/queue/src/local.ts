import { type ImageQueueSender, imageQueueJobSchema } from "./index";

export interface LocalQueueBindings {
  LOCAL_QUEUE_TOKEN: string;
}
/** Used only by generated local Worker configs; production uses the native Queue binding. */
export function localQueueSender(env: LocalQueueBindings): ImageQueueSender {
  return {
    async send(message) {
      const response = await fetch("http://127.0.0.1:8790/enqueue", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.LOCAL_QUEUE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imageQueueJobSchema.parse(message)),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("LOCAL_REDIS_QUEUE_UNAVAILABLE");
    },
  };
}
