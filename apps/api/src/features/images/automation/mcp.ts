import { Buffer } from "node:buffer";
import { BillingError } from "@lycoboai/billing";
import {
  type ImageAutomationSetInput,
  imageAutomationInputSchema,
  imageAutomationSetInputSchema,
  variationPlanLimit,
} from "@lycoboai/contracts";
import { ImageRepositoryError, VariationError } from "@lycoboai/db";
import { maxDisplayThumbnailBytes } from "@lycoboai/storage/variants";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { z } from "zod";
import { ModerationError } from "../../moderation/service";
import { type Env, id } from "../route-context";

type AutomationInput = z.infer<typeof imageAutomationInputSchema>;
type AutomationTools = {
  submit: (input: AutomationInput, key: string) => Promise<Response>;
  submitSet: (input: ImageAutomationSetInput, key: string) => Promise<Response>;
  result: (taskId: string) => Promise<Response>;
  preview: (taskId: string, imageIndex: number) => Promise<Uint8Array | null>;
};
const bodySchema = z.object({ method: z.string() }).passthrough();
const failureSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const submittedSchema = z.looseObject({ id });

function toolError(code: string, message?: string, retryAfter?: string | null) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ code, message, retryAfterSeconds: retryAfter ?? undefined }),
      },
    ],
  };
}

async function toolResult(run: () => Promise<Response>, submissionUrl?: string) {
  try {
    const response = await run();
    const body: unknown = await response.json();
    if (!response.ok) {
      const failure = failureSchema.safeParse(body).data?.error;
      return toolError(
        failure?.code ?? "SERVICE_UNAVAILABLE",
        failure?.message,
        response.headers.get("Retry-After"),
      );
    }
    const result = submissionUrl ? withHistoryUrl(body, submissionUrl) : body;
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  } catch (error) {
    // 工具回复仅透出已知业务错误码，不转发异常、供应商详情或凭据。
    if (
      error instanceof BillingError ||
      error instanceof ImageRepositoryError ||
      error instanceof VariationError ||
      error instanceof ModerationError
    )
      return toolError(error.code);
    return toolError("SERVICE_UNAVAILABLE");
  }
}

function withHistoryUrl(body: unknown, submissionUrl: string) {
  const task = submittedSchema.parse(body);
  const history = new URL("/dashboard/commerce/smart-variation", submissionUrl);
  history.searchParams.set("task", task.id);
  return { ...task, historyUrl: history.href };
}

async function previewResult(read: () => Promise<Uint8Array | null>) {
  const unavailable = () =>
    toolError("PREVIEW_UNAVAILABLE", "暂无可预览的图片，请在 Lycobo 查看任务");
  try {
    const bytes = await read();
    if (!bytes?.byteLength || bytes.byteLength > maxDisplayThumbnailBytes) return unavailable();
    return {
      content: [
        {
          type: "image" as const,
          mimeType: "image/webp",
          data: Buffer.from(bytes).toString("base64"),
        },
      ],
    };
  } catch {
    return unavailable();
  }
}

/** 通过无状态 Streamable HTTP 提供任务提交、查询和缩略图预览。 */
export async function serveImageAutomationMcp(
  c: Context<Env>,
  { submit, submitSet, result, preview }: AutomationTools,
) {
  const body = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success)
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      400,
    );
  const server = new McpServer({ name: "lycobo-image", version: "1.0.0" });
  server.registerTool(
    "generate_image",
    {
      description: "生成一张图片，归入套图计划并返回任务 ID。重试复用原 requestId。",
      inputSchema: imageAutomationInputSchema.extend({ requestId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ requestId, ...input }) => toolResult(() => submit(input, requestId), c.req.url),
  );
  server.registerTool(
    "generate_image_set",
    {
      description:
        "提交一套 1–20 张图片，返回一个套图任务。多套分别调用，每套使用独立 requestId，重试复用各自的 ID。",
      inputSchema: imageAutomationSetInputSchema.extend({ requestId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ requestId, ...input }) => toolResult(() => submitSet(input, requestId), c.req.url),
  );
  server.registerTool(
    "get_image",
    {
      description: "读取当前账号的图片任务状态。完成后提供有有效期的下载链接。",
      inputSchema: { taskId: id },
      annotations: { readOnlyHint: true },
    },
    ({ taskId }) => toolResult(() => result(taskId), c.req.url),
  );
  server.registerTool(
    "preview_image",
    {
      description: "返回任务中一张已生成图片的预览。imageIndex 按已生成图片顺序从 1 开始，默认 1。",
      inputSchema: {
        taskId: id,
        imageIndex: z.number().int().min(1).max(variationPlanLimit).default(1),
      },
      annotations: { readOnlyHint: true },
    },
    ({ taskId, imageIndex }) => previewResult(() => preview(taskId, imageIndex)),
  );
  // HTTP 调用之间不留内存会话，云端定时任务可以跨 Worker 实例执行。
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(c.req.raw, { parsedBody: body.data });
    // 传输层生成自己的响应，明确禁止缓存含有私有缩略图的结果。
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}
