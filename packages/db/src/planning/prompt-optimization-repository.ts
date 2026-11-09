import type { ImageScope } from "@lycoboai/contracts";
import { z } from "zod";

const attempt = z.object({
  status: z.enum(["started", "running", "ready", "failed", "busy", "insufficient"]),
  result: z.string().nullish(),
});

export function promptOptimizationRepository(
  run: (operation: "begin" | "finish", args: Record<string, string | null>) => Promise<unknown>,
) {
  return {
    async begin(scope: ImageScope, key: string, inputHash: string) {
      const { organizationId, userId } = scope;
      return attempt.parse(await run("begin", { organizationId, userId, key, inputHash }));
    },
    async finish(scope: ImageScope, key: string, result: string | null) {
      const { organizationId, userId } = scope;
      return attempt.parse(await run("finish", { organizationId, userId, key, result }));
    },
  };
}
