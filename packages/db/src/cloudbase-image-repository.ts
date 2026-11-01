import { createHash } from "node:crypto";
import {
  imageGenerationInputSchema,
  providerModelForResolution,
  providerSnapshotSchema,
  variationPlanInputSchema,
  variationPlanItemSchema,
  variationPlanLimit,
  variationPlanSchema,
} from "@lycoboai/contracts";
import { z } from "zod";
import {
  type CloudBaseDatabaseBindings,
  CloudBaseOperationError,
  type CloudBaseRpc,
  cloudbaseRpc,
} from "./cloudbase-rpc";
import {
  ImageRepositoryError,
  type ImageRuntimeRepository,
  type IndependentModelConfiguration,
} from "./image-repository";
import { cloudbaseProviderWebhooks } from "./provider-webhook-repository";
import { VariationError } from "./variation-repository";

const row = z.record(z.string(), z.unknown());
const rows = z.array(row);
const idResult = z.object({ id: z.uuid(), replayed: z.boolean() });
const image = z.object({
  id: z.uuid(),
  objectKey: z.string(),
  mimeType: z.literal("image/png"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const variationView = (value: unknown) => {
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.string(),
      input: variationPlanInputSchema,
      items: z.unknown(),
    })
    .parse(value);
  return variationPlanSchema.parse({
    id: parsed.id,
    status: parsed.status,
    ...parsed.input,
    items: parsed.items,
  });
};
/** Main-site runtime uses its existing independent model configuration. */
export function cloudbaseImageRepository(
  call: CloudBaseRpc,
  independent: IndependentModelConfiguration,
): ImageRuntimeRepository {
  const run = async (operation: string, args: Record<string, unknown> = {}) => {
    try {
      return await call("lycobo_image_operation", { p_operation: operation, p_args: args });
    } catch (error) {
      if (error instanceof CloudBaseOperationError) throw new ImageRepositoryError(error.message);
      throw error;
    }
  };
  const variationRun = async (operation: string, args: Record<string, unknown>) => {
    try {
      return await run(operation, args);
    } catch (error) {
      if (error instanceof ImageRepositoryError) {
        const code = z
          .enum([
            "RATE_LIMITED",
            "NOT_FOUND",
            "IDEMPOTENCY_CONFLICT",
            "REFERENCE_NOT_FOUND",
            "STATE_CONFLICT",
          ])
          .safeParse(error.code);
        if (code.success) throw new VariationError(code.data);
      }
      throw error;
    }
  };
  const repository: ImageRuntimeRepository = {
    close: async () => {},
    ...cloudbaseProviderWebhooks(call),
    getMany: async (scope, ids) =>
      rows.parse(
        await call("lycobo_image_batch", {
          p_org: scope.organizationId,
          p_user: scope.userId,
          p_ids: ids,
        }),
      ),
    storageUid: async (scope) =>
      z
        .string()
        .regex(/^[0-9]{10}$/)
        .parse(await run("storageUid", { ...scope })),
    authenticate: async (token) => {
      if (!/^[\w-]{43}$/.test(token)) return null;
      return z
        .object({
          userId: z.uuid(),
          organizationId: z.uuid(),
          uid: z.string().regex(/^[0-9]{10}$/),
          role: z.enum(["admin", "member"]),
        })
        .nullable()
        .parse(
          await run("authenticate", {
            tokenHash: createHash("sha256").update(token).digest("hex"),
          }),
        );
    },
    wallet: async (scope) =>
      z
        .object({ balance: z.number().int().nonnegative() })
        .parse(await run("wallet", { ...scope })),
    walletEntries: async (scope, limit, before) =>
      rows.parse(await run("walletEntries", { ...scope, limit, beforeEntry: before })),
    rechargeOrders: async (scope, limit, before) =>
      rows.parse(await run("rechargeOrders", { ...scope, limit, before })),
    create: async (scope, input, key) => {
      const checked = imageGenerationInputSchema.parse(input);
      let snapshot: ReturnType<IndependentModelConfiguration["resolve"]> | null = null;
      try {
        snapshot = independent.resolve(checked);
      } catch {
        // The transaction checks idempotent replay before requiring current routing.
      }
      return idResult.parse(
        await run("create", {
          ...scope,
          input: checked,
          inputHash: hash(checked),
          key,
          snapshot,
          providerModel: snapshot
            ? providerModelForResolution(snapshot, checked.resolution)
            : undefined,
        }),
      );
    },
    retry: async (scope, jobId, key, itemId, requireManaged = false) => {
      const prior = row.nullable().parse(await run("get", { ...scope, id: jobId }));
      if (!prior) throw new ImageRepositoryError("NOT_FOUND");
      const input = imageGenerationInputSchema.parse(prior.input);
      let snapshot: ReturnType<IndependentModelConfiguration["resolve"]> | null = null;
      try {
        snapshot = independent.resolve(input);
      } catch {
        // Partial/uncertain retries retain their accepted snapshot inside the transaction.
      }
      return idResult.parse(
        await run("retry", {
          ...scope,
          jobId,
          key,
          itemId,
          requireManaged,
          snapshot,
          providerModel: snapshot
            ? providerModelForResolution(snapshot, input.resolution)
            : undefined,
        }),
      );
    },
    providerRetryCandidates: async (scope, jobId, itemId) =>
      z
        .array(
          z.object({
            itemId: z.uuid(),
            taskId: z.string(),
            statusPath: z.string(),
            snapshot: providerSnapshotSchema,
            input: imageGenerationInputSchema,
          }),
        )
        .parse(await run("providerRetryCandidates", { ...scope, jobId, itemId })),
    resumeProvider: async (scope, jobId, itemId) => {
      await run("resumeProvider", { ...scope, jobId, itemId });
    },
    list: async (scope, limit, before, tool) =>
      rows.parse(await run("list", { ...scope, limit, before, tool })),
    get: async (scope, id) => row.nullable().parse(await run("get", { ...scope, id })),
    latestEdit: async (scope, id) =>
      row.nullable().parse(await run("latestEdit", { ...scope, id })),
    archive: async (scope, id) => {
      await run("archive", { ...scope, id });
    },
    addReference: async (scope, image) => {
      await run("addReference", { ...scope, image });
    },
    listAssets: async (scope, limit, before, kind, type) =>
      rows.parse(await run("listAssets", { ...scope, limit, before, kind, type })),
    assetLocations: async (scope, ids) =>
      z
        .array(z.object({ id: z.uuid(), objectKey: z.string() }))
        .parse(await run("assetLocations", { ...scope, ids })),
    asset: async (scope, id) => image.nullable().parse(await run("asset", { ...scope, id })),
    expiredReferences: async () => z.array(image).parse(await run("expiredReferences")),
    markReferenceDeleted: async (id) => {
      await run("markReferenceDeleted", { id });
    },
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
    models: {
      logos: async () => ({
        models:
          independent.capabilities().create?.map((model) => ({ id: model.id, logoUrl: null })) ??
          [],
      }),
      capabilities: async () => independent.capabilities(),
      hasRoute: async (input) => {
        independent.resolve(input);
        return true;
      },
    },
    variation: {
      config: async () => independent.planner,
      begin: async (scope, input, key) => {
        const parsed = variationPlanInputSchema.parse(input);
        const result = z.object({ plan: z.unknown(), replayed: z.boolean() }).parse(
          await variationRun("variationBegin", {
            ...scope,
            input: parsed,
            inputHash: hash(parsed),
            key,
          }),
        );
        return { plan: variationView(result.plan), replayed: result.replayed };
      },
      get: async (scope, id) => {
        const result = await variationRun("variationGet", { ...scope, id });
        return result === null ? null : variationView(result);
      },
      finish: async (scope, id, items, errorCode) => {
        await variationRun("variationFinish", {
          ...scope,
          id,
          items: z.array(variationPlanItemSchema).max(variationPlanLimit).parse(items),
          errorCode,
        });
      },
    },
  };
  return repository;
}
export function openCloudBaseImageRepository(
  env: CloudBaseDatabaseBindings,
  independent: IndependentModelConfiguration,
  request: typeof fetch = fetch,
) {
  return cloudbaseImageRepository(cloudbaseRpc(env, request), independent);
}
