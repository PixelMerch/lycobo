import type { ExportedHandler } from "@cloudflare/workers-types";
import { consumeCloudflareImages, dispatchCloudflareImages } from "./cloudflare-consumer";
import type { CloudflareImageEnv } from "./cloudflare-runtime";

/** 仅处理图片队列与恢复定时任务，不提供公开 HTTP 入口。 */
export default {
  queue: consumeCloudflareImages,
  async scheduled(_controller, env) {
    await dispatchCloudflareImages(env);
  },
} satisfies ExportedHandler<CloudflareImageEnv>;
