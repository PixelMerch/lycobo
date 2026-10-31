import { z } from "zod";

const wakeResultSchema = z.object({ woken: z.boolean() });

/**
 * CloudBase has no queue push: after work is enqueued, ask the consumer function to queue an
 * asynchronous drain. The call carries no paid work and the consumer timer stays the fallback.
 */
export function cloudbaseConsumerWake(
  config: { CLOUDBASE_ENV_ID: string; CLOUDBASE_APIKEY: string },
  functionName: string,
  request: typeof fetch = fetch,
) {
  const url = `https://${config.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/functions/${encodeURIComponent(functionName)}`;
  return async () => {
    try {
      const response = await request(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.CLOUDBASE_APIKEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wake: true }),
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return false;
      }
      const result = wakeResultSchema.safeParse(await response.json());
      return result.success && result.data.woken;
    } catch {
      return false;
    }
  };
}
