import type { ImageGenerationInput } from "@lycoboai/contracts";
import postgres from "postgres";
import { modelManagementRepository } from "../models/model-management-repository";
import { promptOptimizationRepository } from "../planning/prompt-optimization-repository";
import { variationRepository } from "../planning/variation-repository";
import { walletRepository } from "../wallet/wallet-repository";
import { nativeProviderWebhooks } from "../webhooks/provider-webhook-repository";
import { imageAssetRepository } from "./image-asset-repository";
import { imageExecutionRepository } from "./image-execution-repository";
import { imageHistoryRepository } from "./image-history-repository";
import { imageIdentityRepository } from "./image-identity-repository";
import { ImageRepositoryError, type IndependentModelConfiguration } from "./image-repository-types";
import { imageSettlement } from "./image-settlement";
import { imageSubmissionRepository } from "./image-submission-repository";

export {
  type AssetFilters,
  type ClaimedImage,
  type ImagePrincipal,
  ImageRepositoryError,
  type IndependentModelConfiguration,
} from "./image-repository-types";

export function openImageRepository(
  url: string,
  edge = false,
  independent?: IndependentModelConfiguration,
  tasksSince?: Date,
) {
  const sql = postgres(url, {
    max: edge ? 1 : 5,
    fetch_types: !edge,
    prepare: true,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 15000, lock_timeout: 5000 },
  });
  const settlement = imageSettlement(sql, tasksSince);
  return {
    ...nativeProviderWebhooks(sql),
    ...imageIdentityRepository(sql),
    ...imageSubmissionRepository(sql, settlement, independent),
    ...imageHistoryRepository(sql, settlement.expireTimedOut),
    ...imageAssetRepository(sql),
    ...imageExecutionRepository(sql, settlement, independent, tasksSince),
    promptOptimization: promptOptimizationRepository(async (operation, args) => {
      try {
        const [row] =
          await sql`select public.lycobo_prompt_optimization(${operation}, ${sql.json(args)}::jsonb) as result`;
        return row?.result;
      } catch (error) {
        if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT")
          throw new ImageRepositoryError(error.message);
        throw error;
      }
    }),
    variation: {
      ...variationRepository(sql),
      ...(independent ? { config: async () => independent.planner } : {}),
    },
    close: () => sql.end({ timeout: 5 }),
    settleInvalidResponses: settlement.settleInvalidResponses,
    ...walletRepository(sql),
    models: {
      ...modelManagementRepository(sql),
      ...(independent
        ? {
            logos: async () => ({
              models:
                independent
                  .capabilities()
                  .create?.map((model) => ({ id: model.id, logoUrl: null })) ?? [],
            }),
            hasRoute: async (input: ImageGenerationInput) => {
              independent.resolve(input);
              return true;
            },
            capabilities: async () => independent.capabilities(),
          }
        : {}),
    },
  };
}
export type ImageRepository = ReturnType<typeof openImageRepository>;

// Runtime services do not expose provisioning, payment settlement or model-admin writes.
type PortableMethod<T> = T extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<R extends readonly (infer E)[] ? E[] : R>
  : T;
export type ImageRuntimeRepository = {
  [K in Exclude<
    keyof ImageRepository,
    "provision" | "models" | "createRecharge" | "settleRecharge"
  >]: PortableMethod<ImageRepository[K]>;
} & {
  models: Pick<ImageRepository["models"], "logos" | "hasRoute" | "capabilities">;
};
