import { Buffer } from "node:buffer";
import { BillingError } from "@lycoboai/billing";
import {
  automationReferenceLookupSchema,
  type ImageAutomationSetInput,
  imageAutomationInputSchema,
  imageAutomationSetInputSchema,
  imageJobSchema,
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
  prepareReferences: (fingerprints: string[]) => Promise<Response>;
  result: (taskId: string) => Promise<Response>;
  preview: (taskId: string, imageIndex: number) => Promise<Uint8Array | null>;
};
const bodySchema = z.object({ method: z.string() }).passthrough();
const failureSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const submittedSchema = z.looseObject({ id });
const taskIdentifier = z.union([id, imageJobSchema.shape.public_id.unwrap()]);
const checkAtSeconds = [40, 60, 90] as const;

/** 为未取得新任务查询时点的 Agent 提供重查间隔。 */
export const mcpImageRetryAfterSeconds = checkAtSeconds[1] - checkAtSeconds[0];

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

async function toolResult(run: () => Promise<Response>, requestUrl?: string) {
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
    const result = requestUrl
      ? {
          ...withHistoryUrl(body, requestUrl),
          ...(response.status === 202 && { checkAtSeconds, retryAfterSeconds: checkAtSeconds[0] }),
        }
      : body;
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

function withHistoryUrl(body: unknown, requestUrl: string) {
  const task = submittedSchema.parse(body);
  const history = new URL("/dashboard/commerce/smart-variation", requestUrl);
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

/** 通过无状态 Streamable HTTP 提供参考图准备、任务提交和查询。 */
export async function serveImageAutomationMcp(
  c: Context<Env>,
  { submit, submitSet, prepareReferences, result, preview }: AutomationTools,
) {
  const body = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success)
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      400,
    );
  const server = new McpServer({ name: "lycobo-image", version: "1.2.0" });
  server.registerTool(
    "prepare_reference_uploads",
    {
      description:
        "按原文件 SHA-256 批量查重。命中返回素材 ID，未命中返回短期 WebP 上传凭证。不要传文件原文、路径或长期 Key。",
      inputSchema: automationReferenceLookupSchema,
      annotations: { readOnlyHint: true },
    },
    ({ fingerprints }) => toolResult(() => prepareReferences(fingerprints)),
  );
  server.registerTool(
    "generate_image",
    {
      description:
        "生成一张图片，归入套图计划。传入 aspectRatio 指定宽高比。向用户展示回执的 publicId 和 aspectRatio。重试复用原 requestId。",
      inputSchema: imageAutomationInputSchema.extend({ requestId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ requestId, ...input }) => toolResult(() => submit(input, requestId), c.req.url),
  );
  server.registerTool(
    "generate_image_set",
    {
      description:
        "提交一套 1–20 张图片。用 aspectRatio 设置套内共用宽高比。向用户展示回执的 publicId 和 aspectRatio。每套使用独立 requestId，重试复用原值。",
      inputSchema: imageAutomationSetInputSchema.extend({ requestId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ requestId, ...input }) => toolResult(() => submitSet(input, requestId), c.req.url),
  );
  server.registerTool(
    "get_image",
    {
      description:
        "按任务编号或任务 UUID 查询状态。新任务按提交回执的 checkAtSeconds 查询，时间从提交算起。查询已有任务时按 retryAfterSeconds 重查。已有成图时直接提供预览与原图下载链接。",
      inputSchema: { taskId: taskIdentifier },
      annotations: { readOnlyHint: true },
    },
    ({ taskId }) => toolResult(() => result(taskId), c.req.url),
  );
  server.registerTool(
    "preview_image",
    {
      description:
        "按任务编号或任务 UUID 预览一张图片。imageIndex 按已生成图片顺序从 1 开始，默认 1。",
      inputSchema: {
        taskId: taskIdentifier,
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
