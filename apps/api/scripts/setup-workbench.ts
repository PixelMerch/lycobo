import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openImageRepository } from "@lycoboai/db";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai";
const database = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname))
  throw new Error("This setup command only provisions a local development database");
const repository = openImageRepository(databaseUrl);
try {
  let token = process.env.IMAGE_WORKBENCH_TOKEN;
  if (!token || !(await repository.authenticate(token))) {
    const identity = await repository.provision("local-workbench", "本地商家团队", 1000, true);
    token = identity.token;
  }
  const path = resolve("../../.env");
  let source = await readFile(path, "utf8").catch(() => "");
  const values: Record<string, string> = {
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl,
    IMAGE_COMPOSE_DATABASE_URL: (() => {
      const url = new URL(databaseUrl);
      url.hostname = "postgres";
      url.port = "5432";
      return url.href;
    })(),
    IMAGE_DATA_DIR: resolve("../../data/images"),
    IMAGE_WORKBENCH_TOKEN: token,
    VAKV_ENABLE_IMAGE_EDITS: "true",
  };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    source = pattern.test(source)
      ? source.replace(pattern, `${key}=${value}`)
      : `${source.trimEnd()}\n${key}=${value}\n`;
  }
  await writeFile(path, source, { mode: 0o600 });
  process.stdout.write(
    "本地工作台身份已保存到 .env，未输出任何密钥。请在后台配置模型渠道后启动 API 与 Worker。\n",
  );
} finally {
  await repository.close();
}
