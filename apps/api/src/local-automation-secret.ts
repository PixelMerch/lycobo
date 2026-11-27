import { randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

/** 本地 API 在工作区保存独立加密密钥，确保容器重启后仍可解密。 */
export async function localAutomationKeySecret(dataDirectory: string, configured?: string) {
  if (configured) return configured;
  const directory = dataDirectory ? dirname(dataDirectory) : process.cwd();
  const path = resolve(directory, ".env.image-automation-key");
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}`;
  // 先写完再建立链接，并发启动只能采用同一个文件；暂存文件也限制权限。
  await writeFile(temporary, randomBytes(32).toString("base64"), { flag: "wx", mode: 0o600 });
  try {
    await link(temporary, path);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
  } finally {
    await unlink(temporary);
  }
  return (await readFile(path, "utf8")).trim();
}
