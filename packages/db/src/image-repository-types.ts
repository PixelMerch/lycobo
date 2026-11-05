import type {
  AssetTool,
  ImageGenerationInput,
  ImageScope,
  ProviderSnapshot,
} from "@lycoboai/contracts";
import type { modelManagementRepository } from "./model-management-repository";
import type { variationRepository } from "./variation-repository";

export class ImageRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type ImagePrincipal = ImageScope & { role: "admin" | "member"; uid?: string };
/** Asset library filters applied before pagination; favorites belong to the signed-in member. */
export type AssetFilters = {
  includeVideo?: boolean | undefined;
  since?: string | undefined;
  tool?: AssetTool | undefined;
  model?: string | undefined;
  favorite?: boolean | undefined;
};
export type ClaimedImage = {
  itemId: string;
  position: number;
  jobId: string;
  organizationId: string;
  userId: string;
  executionToken: string;
  input: ImageGenerationInput;
  providerModel: ImageGenerationInput["model"];
  configuredProvider?:
    | {
        snapshot: ProviderSnapshot;
        phase: string;
        taskId: string | null;
        statusPath: string | null;
        deadlineAt: Date;
        pollFailures: number;
      }
    | undefined;
};
export interface IndependentModelConfiguration {
  credentialId: string;
  credentialCipher: string;
  planner: NonNullable<Awaited<ReturnType<ReturnType<typeof variationRepository>["config"]>>>;
  capabilities: ReturnType<typeof modelManagementRepository>["capabilities"] extends () => Promise<
    infer T
  >
    ? () => T
    : never;
  resolve: (input: ImageGenerationInput) => ProviderSnapshot;
}
