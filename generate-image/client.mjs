import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

export class ImageToolError extends Error {}

const MAX_BYTES = 64 * 1024 * 1024;
export function apiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ImageToolError("请配置有效的 GENERATE_IMAGE_BASE_URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/v1", "/v1/"].includes(url.pathname)
  )
    throw new ImageToolError("API 地址必须是 HTTPS 根地址或 /v1 地址");
  return url.origin;
}
export function imageSize(value) {
  const tier = { "1K": 1024, "1.5K": 1254, "2K": 2048, "4K": 3840 }[value.toUpperCase()];
  if (tier) return `${tier}x${tier}`;
  const match = /^(\d{2,4})[x×](\d{2,4})$/.exec(value);
  if (!match || match.slice(1).some((n) => Number(n) < 64 || Number(n) > 3840))
    throw new ImageToolError("分辨率使用 1K、1.5K、2K、4K 或 64–3840 范围内的宽x高");
  return `${Number(match[1])}x${Number(match[2])}`;
}
export async function readBytes(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new ImageToolError(`HTTP_${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ImageToolError("接口返回空内容");
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new ImageToolError("返回内容超过64MB限制");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
function taskUrl(value, origin) {
  const url = new URL(value, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1/images/tasks/")
  )
    throw new ImageToolError("拒绝不可信的任务查询地址");
  return url;
}
export function imageExtension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ".png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ".jpg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return ".webp";
  throw new ImageToolError("结果不是支持的 PNG/JPEG/WebP 图片");
}
async function outputBytes(output, origin, key, request) {
  if (typeof output.b64_json === "string") {
    if (output.b64_json.length > MAX_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(output.b64_json))
      throw new ImageToolError("图片编码无效");
    return Buffer.from(output.b64_json, "base64");
  }
  const value = output.signed_url ?? output.download_url ?? output.url;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new ImageToolError("拒绝不可信的下载地址");
  // Never forward the API key to an external CDN or through redirects.
  const headers =
    url.origin === origin && !output.signed_url ? { Authorization: `Bearer ${key}` } : {};
  return readBytes(
    await request(url, { headers, redirect: "error", signal: AbortSignal.timeout(60000) }),
  );
}
/** Submit once; subsequent requests only query the accepted task. */
export async function generateImage({
  origin,
  key,
  model,
  prompt,
  size,
  receipt,
  saveReceipt,
  timeoutSeconds = 1800,
  request = fetch,
  wait = sleep,
}) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let current = receipt ?? { origin, idempotencyKey: randomUUID(), state: "submitting" };
  if (current.origin !== origin) throw new ImageToolError("回执与当前 API 地址不一致");
  if (receipt && !current.statusUrl)
    throw new ImageToolError("提交结果不明确，没有任务地址；请先核对供应商记录，不能盲目重发");
  if (!receipt) await saveReceipt(current);
  let first = !receipt;
  while (Date.now() < deadline) {
    const url = first
      ? new URL("/v1/images/generations", origin)
      : taskUrl(current.statusUrl, origin);
    const response = await request(url, {
      method: first ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(first
          ? { "Content-Type": "application/json", "Idempotency-Key": current.idempotencyKey }
          : {}),
      },
      ...(first
        ? {
            body: JSON.stringify({
              model,
              prompt,
              size,
              n: 1,
              async: true,
              response_format: "url",
            }),
          }
        : {}),
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(60000, Math.max(1, deadline - Date.now()))),
    });
    const result = JSON.parse((await readBytes(response)).toString("utf8"));
    first = false;
    if (result.task_id) {
      const statusUrl = taskUrl(
        result.status_url ??
          result.poll_url ??
          `/v1/images/tasks/${encodeURIComponent(result.task_id)}?view=summary`,
        origin,
      ).href;
      current = { ...current, state: "accepted", taskId: result.task_id, statusUrl };
      await saveReceipt(current);
    }
    if (
      ["failed", "uncertain", "client_disconnected", "canceled", "paused"].includes(result.status)
    )
      throw new ImageToolError(`任务状态：${result.status}；请核对原任务，不会自动重新提交`);
    const outputs = result.data?.length ? result.data : result.assets;
    if (
      Array.isArray(outputs) &&
      outputs.length &&
      (!result.status || ["success", "succeeded"].includes(result.status))
    ) {
      if (outputs.length !== 1) throw new ImageToolError("返回图片数量与请求不一致，请核对原任务");
      const bytes = await outputBytes(outputs[0], origin, key, request);
      imageExtension(bytes);
      return bytes;
    }
    if (!current.statusUrl)
      throw new ImageToolError("没有图片或任务ID，提交结果不明确，请核对供应商记录");
    if (["success", "succeeded"].includes(result.status)) {
      const full = taskUrl(result.result_url ?? current.statusUrl, origin);
      full.searchParams.delete("view");
      current = { ...current, statusUrl: full.href };
      await saveReceipt(current);
    }
    const delay = Number.isFinite(result.poll_after_ms)
      ? Math.min(30000, Math.max(1000, result.poll_after_ms))
      : 2000;
    await wait(Math.min(delay, Math.max(0, deadline - Date.now())));
  }
  throw new ImageToolError("等待超时；请使用 --resume 查询已受理任务，不要重新提交");
}
