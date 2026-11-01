import {
  imageGenerationInputSchema,
  providerSnapshotSchema,
  type StoredImage,
} from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import { standaloneCredentialId } from "@lycoboai/generation";
import { expect, it, vi } from "vitest";
import { drainCloudBaseOutbox } from "./cloudbase-outbox";
import { processConfiguredImage } from "./configured-image-processor";

it("continues a durable provider receipt with GET and stores it without a second paid POST", async () => {
  const itemId = crypto.randomUUID(),
    jobId = crypto.randomUUID(),
    organizationId = crypto.randomUUID(),
    userId = crypto.randomUUID();
  const intent = { id: crypto.randomUUID(), itemId, leaseToken: crypto.randomUUID() };
  const snapshot = providerSnapshotSchema.parse({
    channelId: crypto.randomUUID(),
    credentialId: standaloneCredentialId,
    origin: "https://api.example.com/",
    adapter: "fluxport-images",
    model: "gpt-image-2.5",
    upstreamModel: "fixture",
    mode: "async-preferred",
    resolutions: ["1K"],
    editsEnabled: true,
    maxReferences: 5,
    timeoutMs: 5000,
    taskTimeoutSeconds: 180,
    downloadOrigins: [],
  });
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "isolated fixture",
    resolution: "1K",
    count: 1,
  });
  const stored: StoredImage = {
    id: itemId,
    objectKey: `1234567890/${organizationId}/${itemId}.png`,
    mimeType: "image/png",
    bytes: 5,
    width: 1,
    height: 1,
    sha256: "f".repeat(64),
  };
  let receipt: { taskId: string; statusPath: string } | undefined,
    done = false,
    time = 0;
  const repository: Pick<
    ImageRuntimeRepository,
    | "leaseOutbox"
    | "ackOutbox"
    | "providerCipher"
    | "asset"
    | "deferProvider"
    | "finish"
    | "webhookWait"
  > = {
    leaseOutbox: async () => (done ? [] : [intent]),
    ackOutbox: async () => {},
    providerCipher: async () => "unused",
    asset: async () => null,
    webhookWait: async () => false,
    deferProvider: async (_job, taskId, statusPath) => {
      receipt = { taskId, statusPath };
    },
    finish: vi.fn(async () => {
      done = true;
      return true;
    }),
  };
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        {
          task_id: "fixture-task",
          status: "queued",
          status_url: "/v1/images/tasks/fixture-task",
          poll_after_ms: 3000,
        },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({ status: "success", assets: [{ b64_json: "aGVsbG8=" }] }),
    );
  const store = { read: async () => new Uint8Array(), put: vi.fn(async () => stored) };
  const result = await drainCloudBaseOutbox({
    repository,
    now: () => time,
    stopStartingAt: 20000,
    wait: async (ms) => {
      expect(receipt).toBeDefined();
      time += ms;
    },
    process: async (_itemId, onDeferred) => {
      const job: ClaimedImage = {
        itemId,
        jobId,
        organizationId,
        userId,
        position: 0,
        executionToken: crypto.randomUUID(),
        input,
        providerModel: input.model,
        configuredProvider: {
          snapshot,
          phase: receipt ? "polling" : "submitting",
          taskId: receipt?.taskId ?? null,
          statusPath: receipt?.statusPath ?? null,
          deadlineAt: new Date(Date.now() + 60000),
          pollFailures: 0,
        },
      };
      await processConfiguredImage(job, {
        repository,
        store,
        standaloneKey: "fixture-only",
        request,
        onDeferred,
      });
    },
  });
  expect(result).toEqual({ processed: 1, resumeAt: null });
  expect(time).toBe(3000);
  expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "GET"]);
  expect(request.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Idempotency-Key");
  expect(store.put).toHaveBeenCalledOnce();
  expect(repository.finish).toHaveBeenCalledOnce();
  expect(done).toBe(true);
});

it.each([false, true])(
  "releases webhook waits without holding the consumer open (early receipt: %s)",
  async (early) => {
    const snapshot = providerSnapshotSchema.parse({
      channelId: crypto.randomUUID(),
      credentialId: standaloneCredentialId,
      origin: "https://api.example.com/",
      adapter: "fluxport-images",
      model: "gpt-image-2.5",
      upstreamModel: "fixture",
      mode: "async-preferred",
      resolutions: ["1K"],
      editsEnabled: true,
      maxReferences: 5,
      timeoutMs: 5000,
      taskTimeoutSeconds: 600,
      downloadOrigins: [],
      webhook: { source: "a".repeat(64), waitSeconds: 60 },
    });
    const job: ClaimedImage = {
      itemId: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      position: 0,
      executionToken: crypto.randomUUID(),
      providerModel: "gpt-image-2.5",
      input: imageGenerationInputSchema.parse({
        model: "gpt-image-2.5",
        prompt: "fixture",
        resolution: "1K",
        count: 1,
      }),
      configuredProvider: {
        snapshot,
        phase: "submitting",
        taskId: null,
        statusPath: null,
        deadlineAt: new Date(Date.now() + 600000),
        pollFailures: 0,
      },
    };
    const repository = {
      providerCipher: vi.fn(),
      asset: vi.fn(),
      deferProvider: vi.fn(),
      finish: vi.fn(),
      webhookWait: vi.fn(async () => early),
    };
    const store = { read: vi.fn(), put: vi.fn() };
    const onDeferred = vi.fn();
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          task_id: "fixture-task",
          status: "queued",
          status_url: "/v1/images/tasks/fixture-task",
        },
        { status: 202 },
      ),
    );
    await processConfiguredImage(job, {
      repository,
      store,
      standaloneKey: "fixture",
      request,
      onDeferred,
    });
    expect(repository.webhookWait).toHaveBeenCalledOnce();
    expect(repository.deferProvider).not.toHaveBeenCalled();
    expect(repository.finish).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
    expect(onDeferred).toHaveBeenCalledTimes(early ? 1 : 0);
    // Recovery past the deadline still reads the accepted task once; it never submits again.
    const state = job.configuredProvider;
    if (!state) throw new Error("fixture");
    state.phase = "polling";
    state.taskId = "fixture-task";
    state.statusPath = "/v1/images/tasks/fixture-task";
    state.deadlineAt = new Date(Date.now() - 1000);
    request.mockResolvedValue(Response.json({ status: "running" }));
    await processConfiguredImage(job, {
      repository,
      store,
      standaloneKey: "fixture",
      request,
      onDeferred,
    });
    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "GET"]);
    expect(repository.finish).toHaveBeenCalledWith(job, expect.objectContaining({ unknown: true }));
  },
);
