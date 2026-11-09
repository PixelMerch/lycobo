import type { ImagePrincipal } from "@lycoboai/db";
import type { Context, Hono } from "hono";
import { type Env, fail, type ImageApiDependencies } from "../route-context";
import { imageEventStream } from "./events";

export function registerImageEvents(
  app: Hono<Env>,
  deps: ImageApiDependencies,
  resolvePrincipal: (c: Context) => Promise<ImagePrincipal | undefined | null>,
) {
  const connections = new Map<string, number>();
  app.get("/image-events", async (c) => {
    const feed = deps.events;
    if (!feed) return fail(c, "GENERATION_NOT_CONFIGURED", "实时通知暂不可用", 503);
    const scope = c.get("principal");
    const connectionKey = `${scope.organizationId}:${scope.userId}`;
    if ((connections.get(connectionKey) ?? 0) >= 8)
      return fail(c, "FORBIDDEN", "实时连接过多，请关闭多余页面", 403);
    connections.set(connectionKey, (connections.get(connectionKey) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const count = (connections.get(connectionKey) ?? 1) - 1;
      if (count > 0) connections.set(connectionKey, count);
      else connections.delete(connectionKey);
    };
    try {
      const response = await imageEventStream(c, feed, scope, async () => {
        const current = await resolvePrincipal(c);
        return (
          !!current &&
          current.userId === scope.userId &&
          current.organizationId === scope.organizationId
        );
      });
      if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream")) {
        release();
        return response;
      }
      const reader = response.body.getReader();
      return new Response(
        new ReadableStream({
          async pull(controller) {
            try {
              const next = await reader.read();
              if (next.done) {
                release();
                controller.close();
              } else controller.enqueue(next.value);
            } catch (error) {
              release();
              controller.error(error);
            }
          },
          async cancel() {
            release();
            await reader.cancel();
          },
        }),
        { status: response.status, headers: response.headers },
      );
    } catch {
      release();
      return fail(c, "GENERATION_NOT_CONFIGURED", "实时通知暂不可用", 503);
    }
  });
}
