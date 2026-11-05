import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { z } from "zod";
import type { ImageRuntimeRepository, IndependentModelConfiguration } from "./image-repository";

type RunImageOperation = (operation: string, args?: Record<string, unknown>) => Promise<unknown>;

export function cloudbaseImageExecution(
  run: RunImageOperation,
  independent: IndependentModelConfiguration,
): Pick<
  ImageRuntimeRepository,
  | "leaseOutbox"
  | "ackOutbox"
  | "claim"
  | "providerCipher"
  | "deferProvider"
  | "finish"
  | "pruneEvents"
  | "expireClaims"
  | "settleInvalidResponses"
  | "reconcile"
> {
  return {
    leaseOutbox: async () =>
      z
        .array(z.object({ id: z.uuid(), itemId: z.uuid(), leaseToken: z.uuid() }))
        .parse(await run("leaseOutbox")),
    ackOutbox: async (id, leaseToken) => {
      await run("ackOutbox", { id, leaseToken });
    },
    claim: async (itemId, workerId, leaseMs) => {
      const value = z
        .object({
          itemId: z.uuid(),
          position: z.number().int(),
          jobId: z.uuid(),
          organizationId: z.uuid(),
          userId: z.uuid(),
          executionToken: z.uuid(),
          input: imageGenerationInputSchema,
          providerModel: imageGenerationInputSchema.shape.model,
          configuredProvider: z
            .object({
              snapshot: providerSnapshotSchema,
              phase: z.string(),
              taskId: z.string().nullable(),
              statusPath: z.string().nullable(),
              deadlineAt: z.coerce.date(),
              pollFailures: z.number().int(),
            })
            .nullable(),
        })
        .nullable()
        .parse(await run("claim", { itemId, workerId, leaseMs }));
      return value ? { ...value, configuredProvider: value.configuredProvider ?? undefined } : null;
    },
    providerCipher: async (credentialId) => {
      if (credentialId === independent.credentialId) return independent.credentialCipher;
      return z
        .string()
        .min(1)
        .parse(await run("providerCipher", { id: credentialId }));
    },
    deferProvider: async (job, taskId, statusPath, delayMs, failed = false, requestId) => {
      await run("deferProvider", {
        itemId: job.itemId,
        executionToken: job.executionToken,
        taskId,
        statusPath,
        delayMs,
        failed,
        requestId,
      });
    },
    finish: async (job, result) =>
      z.boolean().parse(
        await run("finish", {
          jobId: job.jobId,
          itemId: job.itemId,
          executionToken: job.executionToken,
          result,
        }),
      ),
    pruneEvents: async () => {
      await run("pruneEvents");
    },
    expireClaims: async () => {
      await run("expireClaims");
    },
    settleInvalidResponses: async () => {
      await run("settleInvalidResponses");
    },
    reconcile: async (scope, jobId, itemId, evidence) => {
      await run("reconcile", { ...scope, jobId, itemId, evidence });
    },
  };
}
