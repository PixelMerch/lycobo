import {
  storyboardOriginalImageLimit,
  storyboardRequestSchema,
  variationPlanInputSchema,
} from "@lycoboai/contracts";
import type { Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { promptOptimization, promptOptimizationInput } from "./prompt-optimization";
import { type Env, fail, type ImageApiDependencies, id } from "./route-context";
import { variationService } from "./variation-service";

type Optimizer = NonNullable<Awaited<ReturnType<ReturnType<typeof promptOptimization>["prepare"]>>>;
type StreamAttempt = Awaited<ReturnType<Optimizer["begin"]>>;

function streamPromptOptimization(
  c: Context<Env>,
  service: Optimizer,
  scope: Parameters<Optimizer["run"]>[0],
  key: string,
  input: Parameters<Optimizer["run"]>[2],
  attempt: StreamAttempt,
) {
  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => abort.abort());
    const signal = AbortSignal.any([abort.signal, c.req.raw.signal]);
    try {
      const result =
        attempt.status === "started"
          ? await service.run(scope, key, input, signal, (text) =>
              stream.writeSSE({ event: "delta", data: JSON.stringify({ text }) }),
            )
          : attempt.result;
      if (result) {
        await stream.writeSSE({ event: "complete", data: JSON.stringify({ text: result }) });
        return;
      }
    } catch {
      // A connection or database failure may have an unknown settlement outcome.
      if (!abort.signal.aborted) await stream.writeSSE({ event: "interrupted", data: "{}" });
      return;
    }
    if (!abort.signal.aborted) await stream.writeSSE({ event: "failed", data: "{}" });
  });
}

export function registerPromptOptimization(app: Hono<Env>, deps: ImageApiDependencies) {
  const optimizer = promptOptimization(deps);
  app.post("/prompt-optimizations", async (c) => {
    const input = promptOptimizationInput.safeParse(await c.req.json().catch(() => null));
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请填写需要优化的提示词", 400);
    const service = await optimizer.prepare();
    if (!service) return fail(c, "GENERATION_NOT_CONFIGURED", "提示词优化暂未开放", 503);
    const scope = c.get("principal");
    const attempt = await service.begin(scope, key.data, input.data);
    if (attempt.status === "insufficient")
      return fail(c, "INSUFFICIENT_CREDITS", "企业积分余额不足，优化提示词需要 1 积分", 409);
    if (attempt.status === "running" || attempt.status === "busy")
      return fail(c, "STATE_CONFLICT", "已有优化进行中或操作过于频繁，请稍后重试", 409);
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("X-Accel-Buffering", "no");
    return streamPromptOptimization(c, service, scope, key.data, input.data, attempt);
  });
}

export function registerImagePlanning(app: Hono<Env>, deps: ImageApiDependencies) {
  const variation = variationService(deps);
  app.get("/variation-plans/capabilities", async (c) =>
    c.json({ enabled: await variation.enabled() }),
  );
  app.post("/variation-plans", async (c) => {
    const input = variationPlanInputSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请填写创作需求并检查参考图", 400);
    if (c.req.header("Accept")?.includes("text/event-stream")) {
      c.header("Cache-Control", "no-cache, no-transform");
      c.header("X-Accel-Buffering", "no");
      return streamSSE(c, async (stream) => {
        const abort = new AbortController();
        stream.onAbort(() => abort.abort());
        try {
          await stream.writeSSE({ event: "started", data: "{}" });
          const plan = await variation.create(
            c.get("principal"),
            input.data,
            key.data,
            AbortSignal.any([abort.signal, c.req.raw.signal]),
            async (text) => {
              await stream.writeSSE({ event: "delta", data: JSON.stringify({ text }) });
            },
            async (stage) => {
              await stream.writeSSE({ event: "status", data: JSON.stringify({ stage }) });
            },
          );
          if (!plan) throw new Error("UNAVAILABLE");
          await stream.writeSSE({ event: "complete", data: JSON.stringify(plan) });
        } catch {
          if (!abort.signal.aborted)
            await stream.writeSSE({
              event: "failed",
              data: JSON.stringify({ message: "计划未完成，请稍后重试" }),
            });
        }
      });
    }
    const plan = await variation.create(c.get("principal"), input.data, key.data, c.req.raw.signal);
    return plan ? c.json(plan) : fail(c, "GENERATION_NOT_CONFIGURED", "智能分析尚未配置", 503);
  });
  app.get("/video-storyboards/capabilities", async (c) =>
    c.json({
      enabled: await variation.storyboardEnabled(),
      maxStoryboardOriginalImages: storyboardOriginalImageLimit,
    }),
  );
  app.post("/video-storyboards", async (c) => {
    const input = storyboardRequestSchema.safeParse(await c.req.json().catch(() => null));
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查商品图、分镜和视频时长", 400);
    const plan = await variation.createStoryboard(
      c.get("principal"),
      input.data,
      key.data,
      c.req.raw.signal,
    );
    return plan ? c.json(plan) : fail(c, "GENERATION_NOT_CONFIGURED", "分镜分析尚未配置", 503);
  });
  app.get("/variation-plans/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "计划编号无效", 400);
    const plan = await deps.repository.variation.get(c.get("principal"), parsed.data);
    return plan ? c.json(plan) : fail(c, "NOT_FOUND", "计划不存在", 404);
  });
}
