import { z } from "zod";

export class PlannerWebError extends Error {
  constructor() {
    super("网页读取未完成，请确认链接可公开访问，或移除链接并粘贴商品信息后重试");
  }
}

export function plannerUrls(description: string) {
  const matches = description.match(/https?:\/\/[^\s<>"'，。；！？、）】]+/gi) ?? [];
  const urls = [
    ...new Set(
      matches.map((value) => {
        try {
          const url = new URL(value.replace(/[)\].,;!?]+$/, ""));
          if (
            url.username ||
            url.password ||
            url.port ||
            !url.hostname.includes(".") ||
            /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
            /^[\d.]+$/.test(url.hostname) ||
            url.hostname.includes(":")
          )
            throw new Error();
          url.hash = "";
          return url.href;
        } catch {
          throw new PlannerWebError();
        }
      }),
    ),
  ];
  if (urls.length > 3) throw new PlannerWebError();
  return urls;
}

const pageSchema = z.object({ title: z.string(), content: z.string().trim().min(40) });

async function readFetchedPage(response: Response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new PlannerWebError();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new PlannerWebError();
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024 * 1024) throw new PlannerWebError();
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const page = pageSchema.parse(JSON.parse(text));
  if (/captcha|verify you are human|access denied|请完成验证|安全验证/i.test(page.title))
    throw new PlannerWebError();
  return page;
}

type PageCache = Map<string, { expires: number; text: string }>;
function prunePageCache(cache: PageCache, now: () => number) {
  for (const [entryKey, entry] of cache) if (entry.expires <= now()) cache.delete(entryKey);
  if (cache.size >= 100) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

/** Only DeepSeek fetches target pages. Never send provider keys to user URLs or redirects. */
export function createPlannerWebReader(request: typeof fetch = fetch, now = Date.now) {
  const cache: PageCache = new Map();
  return async (urls: string[], key: string, partition: string, signal: AbortSignal) => {
    const group = new AbortController();
    const timeout = AbortSignal.any([signal, group.signal, AbortSignal.timeout(15000)]);
    try {
      const pages = await Promise.all(
        urls.map(async (url) => {
          timeout.throwIfAborted();
          const cacheKey = JSON.stringify([partition, url]);
          const existing = cache.get(cacheKey);
          if (existing && existing.expires > now()) return existing.text;
          cache.delete(cacheKey);
          const response = await request("https://api.deepseek.com/v1/tools/fetch", {
            method: "POST",
            redirect: "error",
            signal: timeout,
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          const page = await readFetchedPage(response);
          const result = JSON.stringify({
            url,
            title: page.title.slice(0, 300),
            content: page.content.slice(0, 10000),
          });
          prunePageCache(cache, now);
          cache.set(cacheKey, { expires: now() + 5 * 60000, text: result });
          return result;
        }),
      );
      return pages.join("\n");
    } catch {
      throw new PlannerWebError();
    } finally {
      group.abort();
    }
  };
}
