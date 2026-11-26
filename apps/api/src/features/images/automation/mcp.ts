import { BillingError } from "@lycoboai/billing";
import { imageAutomationInputSchema } from "@lycoboai/contracts";
import { ImageRepositoryError } from "@lycoboai/db";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { z } from "zod";
import { ModerationError } from "../../moderation/service";
import { type Env, id } from "../route-context";

type AutomationInput = z.infer<typeof imageAutomationInputSchema>;
const bodySchema = z.object({ method: z.string() }).passthrough();
const failureSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

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

async function toolResult(run: () => Promise<Response>) {
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
    return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
  } catch (error) {
    // 工具回复仅透出已知业务错误码，不转发异常、供应商详情或凭据。
    if (
      error instanceof BillingError ||
      error instanceof ImageRepositoryError ||
      error instanceof ModerationError
    )
      return toolError(error.code);
    return toolError("SERVICE_UNAVAILABLE");
  }
}

/** 为豆包企业连接器提供无状态 Streamable HTTP 生图工具。 */
export async function serveImageAutomationMcp(
  c: Context<Env>,
  submit: (input: AutomationInput, key: string) => Promise<Response>,
  result: (taskId: string) => Promise<Response>,
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
      description: "生成一张图片并返回任务 ID。相同触发事件的重试必须复用 requestId。",
      inputSchema: imageAutomationInputSchema.extend({ requestId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ requestId, ...input }) => toolResult(() => submit(input, requestId)),
  );
  server.registerTool(
    "get_image",
    {
      description: "读取当前账号的图片任务状态。完成后提供有有效期的下载链接。",
      inputSchema: { taskId: id },
      annotations: { readOnlyHint: true },
    },
    ({ taskId }) => toolResult(() => result(taskId)),
  );
  // HTTP 调用之间不留内存会话，云端定时任务可以跨 Worker 实例执行。
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(c.req.raw, { parsedBody: body.data });
  } finally {
    await server.close();
  }
}
