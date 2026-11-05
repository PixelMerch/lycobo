import type { ImageScope } from "@lycoboai/contracts";
import { videoCreateSchema, videoTaskSchema } from "@lycoboai/contracts";
import { type VideoRepository, videoCredentialHash } from "@lycoboai/db";
import type { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { z } from "zod";
export function videoService(deps: {
  repository: VideoRepository;
  origin: string;
  key: string;
  sign: ReturnType<typeof assetDeliverySigner>;
  referencesReady?: boolean;
  wake?: (() => Promise<void>) | undefined;
}) {
  const referenceImagesEnabled = deps.referencesReady !== false;
  const deliver = async (raw: unknown) =>
    Promise.all(
      z
        .array(videoTaskSchema.extend({ object_key: z.string().nullable() }))
        .parse(raw)
        .map(async (row) => {
          const { object_key, ...task } = row;
          return { ...task, ...(object_key ? { delivery: await deps.sign(object_key) } : {}) };
        }),
    );
  return {
    referenceImagesEnabled,
    list: async (scope: ImageScope, before?: string) => ({
      data: await deliver(await deps.repository.list(scope, before)),
    }),
    get: async (scope: ImageScope, id: string) =>
      (await deliver(await deps.repository.get(scope, id)))[0] ?? null,
    create: async (scope: ImageScope, raw: unknown, key: string) => {
      const input = videoCreateSchema.parse(raw);
      if (input.referenceAssetIds.length && !referenceImagesEnabled)
        throw new Error("VIDEO_REFERENCES_UNAVAILABLE");
      const accepted = await deps.repository.create(scope, input, key, {
        origin: deps.origin,
        credentialHash: videoCredentialHash(deps.key),
      });
      await deps.wake?.().catch(() => {
        // A failed wake leaves the durable outbox available for a later drain.
      });
      return accepted;
    },
  };
}
