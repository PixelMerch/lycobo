import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Long-lived Node pool, created explicitly at startup. Never connect on module import.
export function openDatabase(url: string) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("Invalid database protocol");
  const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

export * from "./image-repository";
export { schema };
