import { readFile, writeFile } from "node:fs/promises";
import { supabaseMigrationTarget } from "../../packages/db/scripts/supabase-target.mjs";
import { accountId } from "./config.mjs";

const token = process.env.CLOUDFLARE_API_TOKEN;
async function api(route, method = "GET", body) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}${route}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    },
  );
  const payload = await response.json();
  if (!response.ok || payload.success !== true)
    throw new Error(
      `Cloudflare ${method} ${route.split("?")[0]} failed (${response.status}); check scoped token, account subscriptions and resource state. No automatic subscription or retry was performed.`,
    );
  return payload.result;
}
try {
  if (!token)
    throw new Error(
      "Set a scoped CLOUDFLARE_API_TOKEN in ignored .env first; no resources were changed.",
    );
  if ((process.env.CLOUDFLARE_ACCOUNT_ID ?? accountId) !== accountId)
    throw new Error("Unexpected Cloudflare account.");
  const target = new URL(supabaseMigrationTarget(process.env).url);
  const buckets = await api("/r2/buckets");
  if (!Array.isArray(buckets.buckets)) throw new Error("Unexpected R2 response.");
  if (!buckets.buckets.some((bucket) => bucket.name === "lycobo"))
    await api("/r2/buckets", "POST", { name: "lycobo" });
  const queues = await api("/queues");
  if (!Array.isArray(queues)) throw new Error("Unexpected Queues response.");
  for (const name of ["lycobo-generation", "lycobo-generation-dead"]) {
    if (!queues.some((queue) => queue.queue_name === name))
      await api("/queues", "POST", { queue_name: name });
  }
  const configurations = await api("/hyperdrive/configs");
  if (!Array.isArray(configurations)) throw new Error("Unexpected Hyperdrive response.");
  let hyperdrive = configurations.find((config) => config.name === "lycobo-supabase");
  if (hyperdrive) {
    if (
      hyperdrive.origin?.host !== target.hostname ||
      hyperdrive.origin?.database !== "postgres" ||
      hyperdrive.origin?.user !== "postgres"
    )
      throw new Error("Existing lycobo-supabase targets another database; left unchanged.");
    if (hyperdrive.caching?.disabled !== true)
      hyperdrive = await api(`/hyperdrive/configs/${hyperdrive.id}`, "PATCH", {
        caching: { disabled: true },
      });
  } else {
    hyperdrive = await api("/hyperdrive/configs", "POST", {
      name: "lycobo-supabase",
      caching: { disabled: true },
      origin_connection_limit: 10,
      origin: {
        host: target.hostname,
        port: 5432,
        database: "postgres",
        scheme: "postgres",
        user: "postgres",
        password: decodeURIComponent(target.password),
      },
      // Hyperdrive require validates server certificates with WebPKI.
      mtls: { sslmode: "require" },
    });
  }
  if (typeof hyperdrive.id !== "string" || !/^[a-f0-9]{32}$/.test(hyperdrive.id))
    throw new Error("Invalid Hyperdrive identifier.");
  const pages = await api("/pages/projects");
  if (!Array.isArray(pages)) throw new Error("Unexpected Pages response.");
  let page = pages.find((project) => project.name === "lycobo");
  if (!page)
    page = await api("/pages/projects", "POST", { name: "lycobo", production_branch: "main" });
  let source = await readFile(".env", "utf8");
  if (
    !process.env.CLOUDFLARE_PUBLIC_ORIGIN &&
    typeof page.subdomain === "string" &&
    /^[a-z0-9.-]+\.pages\.dev$/.test(page.subdomain)
  ) {
    const origin = `CLOUDFLARE_PUBLIC_ORIGIN=https://${page.subdomain}`;
    source = /^CLOUDFLARE_PUBLIC_ORIGIN=.*$/m.test(source)
      ? source.replace(/^CLOUDFLARE_PUBLIC_ORIGIN=.*$/m, origin)
      : `${source.trimEnd()}\n${origin}\n`;
  }
  const line = `CLOUDFLARE_HYPERDRIVE_ID=${hyperdrive.id}`;
  source = /^CLOUDFLARE_HYPERDRIVE_ID=.*$/m.test(source)
    ? source.replace(/^CLOUDFLARE_HYPERDRIVE_ID=.*$/m, line)
    : `${source.trimEnd()}\n${line}\n`;
  await writeFile(".env", source, { mode: 0o600 });
  console.info(
    "Private R2, Queues, Hyperdrive (query caching disabled) and Pages are configured. Saved resource ID to ignored .env; no account subscription was changed.",
  );
} catch (error) {
  // Network/driver error messages may include credential-bearing request details.
  console.error(
    error instanceof Error &&
      /^(Set |Unexpected |Existing |Invalid |Cloudflare )/.test(error.message)
      ? error.message
      : "Cloudflare resource setup interrupted; inspect existing named resources before retrying. Credentials were not printed.",
  );
  process.exitCode = 1;
}
