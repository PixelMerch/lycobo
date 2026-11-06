import { expect, it, vi } from "vitest";
import { promptOptimization } from "../apps/api/src/features/images/prompt-optimization";

it.each([302, 403])(
  "refunds provider rejection %s once without logging private data",
  async (status) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const finish = vi.fn(async () => ({ status: "failed" }));
    const request = vi.fn(
      async (_input, _init) => new Response("private-provider-response", { status }),
    );
    const optimizer = promptOptimization({
      repository: {
        promptOptimization: { finish },
        variation: {
          config: async () => ({
            origin: "https://api.deepseek.com/",
            protocol: "openai-chat",
            model: "deepseek-flash",
            timeoutMs: 1000,
          }),
        },
      },
      plannerKey: "private-fixture-key",
      plannerRequest: request,
    });
    const service = await optimizer.prepare();
    const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
    const key = crypto.randomUUID();
    const result = await service.run(
      scope,
      key,
      { tool: "create", prompt: "private-user-prompt" },
      new AbortController().signal,
      async () => undefined,
    );
    expect(result).toBeNull();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][1].redirect).toBe("manual");
    expect(finish).toHaveBeenCalledExactlyOnceWith(scope, key, null);
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: "PROMPT_OPTIMIZATION_FAILED",
      code: "PROVIDER_RESPONSE_REJECTED",
      status,
      aborted: false,
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-/);
  },
);
