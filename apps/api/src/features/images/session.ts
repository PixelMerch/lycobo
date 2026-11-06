import type { ImagePrincipal, ImageRuntimeRepository } from "@lycoboai/db";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

export type WorkbenchSession = { token: string; origins: string[] };
export function readWorkbenchSession(
  env: Record<string, string | undefined>,
): WorkbenchSession | undefined {
  if (!env.IMAGE_WORKBENCH_TOKEN) return undefined;
  if (env.NODE_ENV !== "development" || !/^[\w-]{43}$/.test(env.IMAGE_WORKBENCH_TOKEN))
    throw new Error("Workbench auto-session requires local development configuration");
  const origins = (
    env.IMAGE_WORKBENCH_ORIGINS ??
    "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
  ).split(",");
  for (const origin of origins) {
    const url = new URL(origin);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.origin !== origin)
      throw new Error("Workbench auto-session is restricted to explicit loopback origins");
  }
  return { token: env.IMAGE_WORKBENCH_TOKEN, origins };
}
export function trustedWorkbenchRequest(c: Context, session: WorkbenchSession) {
  const origin = c.req.header("Origin");
  return (
    !!origin && session.origins.includes(origin) && c.req.header("Sec-Fetch-Site") !== "cross-site"
  );
}
export async function workbenchPrincipal(
  c: Context,
  repository: ImageRuntimeRepository,
  session?: WorkbenchSession,
): Promise<ImagePrincipal | null> {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) return repository.authenticate(auth.slice(7));
  if (!session) return null;
  if (c.req.header("Sec-Fetch-Site") === "cross-site") return null;
  if (!["GET", "HEAD"].includes(c.req.method) && !trustedWorkbenchRequest(c, session)) return null;
  const token = getCookie(c, "lycobo_image_session");
  return token === session.token ? repository.authenticate(token) : null;
}
export function setWorkbenchCookie(c: Context, session: WorkbenchSession) {
  setCookie(c, "lycobo_image_session", session.token, {
    httpOnly: true,
    sameSite: "Strict",
    path: "/api",
    maxAge: 60 * 60 * 8,
    secure: c.req.header("Origin")?.startsWith("https:") ?? false,
  });
}
