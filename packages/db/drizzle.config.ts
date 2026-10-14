import { defineConfig } from "drizzle-kit";

if (process.argv.includes("migrate") && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be explicit when running migrations");
}
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai",
  },
  strict: true,
  verbose: true,
});
