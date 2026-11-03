import type { ImageScope } from "@lycoboai/contracts";
import { videoInputSchema, videoTaskSchema } from "@lycoboai/contracts";
import { type VideoRepository, videoCredentialHash } from "@lycoboai/db";
import type { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { z } from "zod";
export function videoService(deps: {
  repository: VideoRepository;
  origin: string;
  key: string;
  sign: ReturnType<typeof assetDeliverySigner>;
  wake?: (() => Promise<void>) | undefined;
}) {
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
    list: async (scope: ImageScope, before?: string) => ({
      data: await deliver(await deps.repository.list(scope, before)),
    }),
    get: async (scope: ImageScope, id: string) =>
      (await deliver(await deps.repository.get(scope, id)))[0] ?? null,
    create: async (scope: ImageScope, raw: unknown, key: string) => {
      const input = videoInputSchema.parse(raw);
      const accepted = await deps.repository.create(scope, input, key, {
        origin: deps.origin,
        credentialHash: videoCredentialHash(deps.key),
      });
      // The durable outbox survives a failed wake; timer and subsequent reads can wake it again.
      await deps.wake?.().catch(() => {});
      return accepted;
    },
  };
}
