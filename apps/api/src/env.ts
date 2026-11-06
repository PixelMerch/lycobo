import { z } from "zod";

const envSchema = z.object({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});
export function readEnv(input: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid API configuration; check .env.example.");
  return parsed.data;
}
