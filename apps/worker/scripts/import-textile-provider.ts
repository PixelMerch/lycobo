import { readFile } from "node:fs/promises";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { parseEnv } from "node:util";
import { channelInputSchema, providerInputSchema } from "@lycoboai/contracts";
import { openImageRepository } from "@lycoboai/db";
import { imageProviderOrigin, openProviderKey } from "@lycoboai/generation";
import { z } from "zod";

async function main() {
  // Local, explicit configuration import. Never submits a generation request.
  const apply = process.argv.slice(2).includes("--apply");
  if (process.argv.slice(2).some((a) => a !== "--apply"))
    throw new Error("Only --apply is supported");
  const source = parseEnv(
    await readFile(fileURLToPath(new NodeURL("../../../.env", import.meta.url)), "utf8"),
  );
  const origin = imageProviderOrigin(source.VAKV_BASE_URL ?? "");
  const provider = providerInputSchema.parse({
    name: process.env.MODEL_PROVIDER_NAME ?? "FluxPort Images",
    origin,
    adapter: "fluxport-images",
    enabled: false,
    apiKey: source.VAKV_API_KEY,
  });
  if (!provider.apiKey) throw new Error("VAKV_API_KEY_REQUIRED");
  const secret = source.MODEL_CREDENTIAL_SECRET;
  if (!secret) throw new Error("MODEL_CREDENTIAL_SECRET_REQUIRED");
  if (!apply) {
    console.info({
      action: "import-local-textile-provider",
      origin,
      adapter: provider.adapter,
      upstreamModel: "gpt-image-2.5",
      mode: "async-preferred",
      newChannelResolutions: ["1K"],
      credentials: "configured; never printed",
      applied: false,
    });
    process.exit(0);
  }
  const connection = process.env.DATABASE_URL;
  if (!connection || !["localhost", "127.0.0.1"].includes(new URL(connection).hostname))
    throw new Error("EXPLICIT_LOCAL_DATABASE_REQUIRED");
  const api = new URL(process.env.ADMIN_API_ORIGIN ?? "http://127.0.0.1:3002");
  if (
    !["localhost", "127.0.0.1"].includes(api.hostname) ||
    api.protocol !== "http:" ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname !== "/"
  )
    throw new Error("LOCAL_ADMIN_API_REQUIRED");
  const account = process.env.ADMIN_ACCOUNT,
    password = process.env.ADMIN_PASSWORD;
  if (!account || !password) throw new Error("ADMIN_LOGIN_REQUIRED");
  let cookie = "";
  async function call(path: string, body?: unknown) {
    const response = await fetch(new URL(`/api/${path}`, api), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.ADMIN_WEB_ORIGIN ?? "http://localhost:8082",
        Cookie: cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`LOCAL_ADMIN_HTTP_${response.status}`);
    const value = z
      .object({ code: z.literal(0), data: z.unknown() })
      .parse(await response.json()).data;
    if (path === "admin-auth/login") {
      cookie =
        response.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .find((v) => v?.startsWith("lycobo_admin_session=")) ?? "";
      if (!cookie) throw new Error("ADMIN_COOKIE_REQUIRED");
    }
    return value;
  }
  const repository = openImageRepository(connection);
  try {
    await call("admin-auth/login", { account, password });
    const settings = z
      .object({
        providers: z.array(z.object({ id: z.uuid(), name: z.string(), origin: z.string() })),
        channels: z.array(
          z.object({ id: z.uuid(), name: z.string(), settings: channelInputSchema }),
        ),
      })
      .parse(await call("model-management/"));
    const existing = settings.providers.find((p) => p.name === provider.name);
    let unchanged = false;
    if (existing && existing.origin === origin) {
      const stored = await repository.models.provider(existing.id);
      if (stored) {
        try {
          unchanged = (await openProviderKey(stored.ciphertext, secret)) === provider.apiKey;
        } catch {
          throw new Error("ADMIN_WORKER_ENCRYPTION_KEYS_DIFFER");
        }
      }
    }
    const { apiKey, ...withoutKey } = provider;
    const saved = z
      .object({ id: z.uuid() })
      .parse(
        await call(
          `model-management/providers${existing ? `/${existing.id}` : ""}`,
          unchanged ? withoutKey : provider,
        ),
      );
    const persisted = await repository.models.provider(saved.id);
    if (!persisted || (await openProviderKey(persisted.ciphertext, secret)) !== apiKey)
      throw new Error("ADMIN_WORKER_ENCRYPTION_KEYS_DIFFER");
    const name = "家纺裂变 · gpt-image-2.5";
    const channel = settings.channels.find((c) => c.name === name);
    const input = channelInputSchema.parse({
      name,
      providerId: saved.id,
      model: "gpt-image-2.5",
      upstreamModel: "gpt-image-2.5",
      mode: "async-preferred",
      enabled: true,
      editsEnabled: true,
      resolutions: channel?.settings.resolutions ?? ["1K"],
      maxReferences: 6,
      timeoutMs: 60000,
      taskTimeoutSeconds: 1800,
      downloadOrigins: [],
    });
    const savedChannel = z
      .object({ id: z.uuid() })
      .parse(await call(`model-management/channels${channel ? `/${channel.id}` : ""}`, input));
    await call("model-management/routes", {
      tool: "textile-set",
      model: "gpt-image-2.5",
      channelId: savedChannel.id,
    });
    await call(`model-management/providers/${saved.id}`, { ...withoutKey, enabled: true });
    console.info({
      applied: true,
      origin,
      adapter: provider.adapter,
      model: input.upstreamModel,
      mode: input.mode,
      resolutions: input.resolutions,
      tool: "textile-set",
      paidRequests: 0,
    });
  } finally {
    if (cookie) await call("admin-auth/logout", {}).catch(() => {});
    await repository.close();
  }
}
await main().catch((error: unknown) => {
  const code =
    error instanceof Error && /^[A-Z][A-Z_0-9]*$/.test(error.message)
      ? error.message
      : "LOCAL_PROVIDER_IMPORT_FAILED";
  console.error(code);
  process.exitCode = 1;
});
