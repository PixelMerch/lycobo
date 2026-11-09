import type { imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageEventFeed, ImagePrincipal, ImageRuntimeRepository } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage/core";
import type { Context } from "hono";
import { z } from "zod";
import type { EnterpriseAuth } from "../auth/service";
import type { DeliverySigner } from "./assets/delivery";
import type { WorkbenchSession } from "./session";

export type ImageApiDependencies = {
  repository: ImageRuntimeRepository;
  uploadsEnabled?: boolean;
  uploads?: {
    enqueue(scope: ImagePrincipal, bytes: Uint8Array): Promise<string>;
    status(
      scope: ImagePrincipal,
      id: string,
    ): Promise<{ status: string; image?: import("@lycoboai/contracts").StoredImage } | null>;
  };
  modelSecret?: string | undefined;
  plannerKey?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
  standaloneKey?: string | undefined;
  providerRequest?: typeof fetch | undefined;
  events?: ImageEventFeed | undefined;
  // Starts background processing after work is enqueued when the transport has no push.
  wake?: (() => Promise<void>) | undefined;
  signAsset?: DeliverySigner | undefined;
  auth?: EnterpriseAuth | undefined;
  store: ImageStore;
  enabled: boolean;
  managedModelsOnly?: boolean;
  unitCredits: number;
  editsEnabled?: boolean;
  session?: WorkbenchSession | undefined;
  // Capability policy is shared with the Worker and injected at startup.
  validate: (input: z.infer<typeof imageGenerationInputSchema>) => void;
  resolutions: (model: z.infer<typeof imageGenerationInputSchema>["model"]) => string[];
};
export type Env = { Variables: { principal: ImagePrincipal; requestId: string } };
export const id = z.uuid();
export const fail = (
  c: Context<Env>,
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 503,
) => c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
