#!/usr/bin/env node
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { apiOrigin, generateImage, ImageToolError, imageExtension, imageSize } from "./client.mjs";

const help = `生图并保存（每次1张）
node generate-image/generate.mjs --resolution 1.5K --prompt '商品摄影' --folder ./output --filename product.png

必填：--resolution 档位或宽x高；--prompt 提示词；--folder 文件夹；--filename 文件名
可选：--model 模型（默认gpt-image-2.5）；--env-file 环境文件；--timeout 秒（默认1800）
续查：--resume 回执路径（仍需指定 --folder 和 --filename，不再次创建付费任务）
环境：GENERATE_IMAGE_BASE_URL、GENERATE_IMAGE_API_KEY、GENERATE_IMAGE_MODEL（可选）
`;
async function main() {
  const { values } = parseArgs({
    options: Object.fromEntries(
      ["resolution", "prompt", "folder", "filename", "model", "env-file", "timeout", "resume"]
        .map((name) => [name, { type: "string" }])
        .concat([["help", { type: "boolean" }]]),
    ),
  });
  if (values.help) {
    console.log(help);
    return;
  }
  if (values["env-file"]) loadEnvFile(resolve(values["env-file"]));
  const key = process.env.GENERATE_IMAGE_API_KEY;
  const origin = apiOrigin(process.env.GENERATE_IMAGE_BASE_URL ?? "");
  if (!key) throw new ImageToolError("请配置 GENERATE_IMAGE_API_KEY");
  if (
    !values.folder ||
    !values.filename ||
    basename(values.filename) !== values.filename ||
    [".", ".."].includes(values.filename)
  )
    throw new ImageToolError("请指定文件夹和不含路径的文件名");
  const prompt = values.prompt?.trim();
  if (!values.resume && (!prompt || !values.resolution))
    throw new ImageToolError("请指定分辨率和非空提示词");
  const timeoutSeconds = Number(values.timeout ?? 1800);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600)
    throw new ImageToolError("超时范围为1–3600秒");
  const folder = resolve(values.folder);
  await mkdir(folder, { recursive: true });
  const receiptPath = values.resume
    ? resolve(values.resume)
    : resolve(folder, `${values.filename}.task.json`);
  const receipt = values.resume ? JSON.parse(await readFile(receiptPath, "utf8")) : undefined;
  // Reserve the destination before making a paid request. Never overwrite user files.
  const target = resolve(folder, values.filename);
  await writeFile(target, "", { flag: "wx", mode: 0o600 });
  console.error("正在生成图片；任务回执：", receiptPath);
  let completed = false;
  try {
    const bytes = await generateImage({
      origin,
      key,
      prompt,
      size: values.resume ? undefined : imageSize(values.resolution),
      model: values.model ?? process.env.GENERATE_IMAGE_MODEL ?? "gpt-image-2.5",
      receipt,
      timeoutSeconds,
      saveReceipt: async (value) =>
        writeFile(receiptPath, `${JSON.stringify(value, null, 2)}\n`, {
          mode: 0o600,
          flag: !values.resume && value.state === "submitting" ? "wx" : "w",
        }),
    });
    const extension = imageExtension(bytes);
    const requested = extname(values.filename).toLowerCase();
    const matches = requested === extension || (requested === ".jpeg" && extension === ".jpg");
    const output = matches
      ? target
      : `${target.slice(0, requested ? -requested.length : undefined)}${extension}`;
    await writeFile(output, bytes, { mode: 0o600, ...(output !== target ? { flag: "wx" } : {}) });
    if (output !== target) await unlink(target);
    completed = true;
    console.log(
      JSON.stringify({
        status: "saved",
        path: output,
        bytes: bytes.length,
        format: extension.slice(1),
        receipt: receiptPath,
      }),
    );
  } finally {
    if (!completed) {
      await unlink(target);
    }
  }
}
main().catch((error) => {
  if (error instanceof ImageToolError) console.error(error.message);
  else if (error?.code === "EEXIST")
    console.error("目标文件或任务回执已存在，未覆盖；请使用回执续查或选择新文件名。");
  // Provider errors and signed URLs must not leak credentials or prompts into agent logs.
  console.error(
    "生成或保存未完成。请检查参数、环境配置及任务回执；已受理的任务使用 --resume 续查，不要重复提交。使用 --help 查看用法。",
  );
  process.exitCode = 1;
});
