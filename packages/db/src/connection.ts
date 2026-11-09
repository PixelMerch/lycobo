import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** 显式创建隔离本地开发的数据库连接池，关闭时释放全部连接。 */
export function openDatabase(url: string) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("Invalid database protocol");
  const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
