import { expect, it, vi } from "vitest";
import {
  consumeCloudflareImages,
  dispatchCloudflareImages,
} from "../apps/worker/src/cloudflare/cloudflare-consumer";
import { openCloudflareRuntime } from "../apps/worker/src/cloudflare/cloudflare-runtime";
import { processCloudflareVariants } from "../apps/worker/src/cloudflare/cloudflare-variants";
import { processImageItem } from "../apps/worker/src/images/image-processor";
import { openRealtimeRepository } from "../packages/db/src/index";

vi.mock("../packages/db/src/index", async (importOriginal) => ({
  ...(await importOriginal()),
  openRealtimeRepository: vi.fn(() => ({
    pending: async () => [],
    prune: async () => undefined,
    close: async () => undefined,
  })),
}));
vi.mock("../apps/worker/src/cloudflare/cloudflare-runtime", () => ({
  openCloudflareRuntime: vi.fn(),
}));
vi.mock("../apps/worker/src/images/image-processor", () => ({ processImageItem: vi.fn() }));
vi.mock("../apps/worker/src/cloudflare/cloudflare-variants", () => ({
  processCloudflareVariants: vi.fn(),
}));

it("processes uploads but never starts, scans or settles paid work while generation is disabled", async () => {
  const process = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const expireClaims = vi.fn();
  const leaseOutbox = vi.fn();
  vi.mocked(openCloudflareRuntime).mockResolvedValue({
    uploads: { process, recover: vi.fn() },
    repository: { close, expireClaims, leaseOutbox },
  });
  const env = {
    HYPERDRIVE: { connectionString: "fixture-only" },
    CLOUDFLARE_CONSUMER_ENABLED: "true",
    CLOUDFLARE_GENERATION_ENABLED: "false",
    MEDIA: {
      get: vi.fn(async () => null),
      list: vi.fn(async () => ({ objects: [], truncated: false })),
      delete: vi.fn(async () => undefined),
    },
  };
  const uploadId = crypto.randomUUID();
  const uploaded = { body: { version: 1, uploadId }, ack: vi.fn(), retry: vi.fn() };
  const paid = { body: { version: 1, itemId: crypto.randomUUID() }, ack: vi.fn(), retry: vi.fn() };
  const batch = { messages: [uploaded, paid] };
  await consumeCloudflareImages(batch, env);
  expect(process).toHaveBeenCalledExactlyOnceWith(uploadId);
  expect(uploaded.ack).toHaveBeenCalledOnce();
  expect(paid.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 60 });
  expect(processImageItem).not.toHaveBeenCalled();
  expect(openRealtimeRepository).toHaveBeenCalledTimes(1);
  await dispatchCloudflareImages(env);
  expect(expireClaims).not.toHaveBeenCalled();
  expect(leaseOutbox).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(2);
});

it.each([
  { kind: "poll", delaySeconds: 7 },
  { kind: "webhook", ready: false, delaySeconds: 60 },
  { kind: "webhook", ready: true, delaySeconds: 2 },
])(
  "schedules a durable original-task lookup for $kind ($delaySeconds seconds)",
  async (scenario) => {
    const close = vi.fn(async () => undefined);
    vi.mocked(openCloudflareRuntime).mockResolvedValue({
      repository: { close },
      store: {},
      policy: {},
    });
    vi.mocked(processImageItem).mockImplementationOnce(async (_itemId, deps) => {
      if (scenario.kind === "poll") deps.onDeferred(7000);
      else deps.onWebhookAccepted(scenario.ready);
    });
    const send = vi.fn(async () => undefined);
    const env = {
      HYPERDRIVE: { connectionString: "fixture-only" },
      CLOUDFLARE_CONSUMER_ENABLED: "true",
      CLOUDFLARE_GENERATION_ENABLED: "true",
      IMAGE_QUEUE: { send },
    };
    const body = { version: 1, itemId: crypto.randomUUID() };
    const message = { body, ack: vi.fn(), retry: vi.fn() };
    await consumeCloudflareImages({ messages: [message] }, env);
    expect(send).toHaveBeenCalledExactlyOnceWith(body, { delaySeconds: scenario.delaySeconds });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(openRealtimeRepository).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledOnce();
  },
);

it("skips realtime queries for variant repairs and closes the runtime", async () => {
  const close = vi.fn(async () => undefined);
  vi.mocked(openCloudflareRuntime).mockResolvedValue({ repository: { close } });
  const env = { CLOUDFLARE_CONSUMER_ENABLED: "true" };
  const body = {
    version: 1,
    assetId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
  };
  const message = { body, ack: vi.fn(), retry: vi.fn() };
  await consumeCloudflareImages({ messages: [message] }, env);
  expect(processCloudflareVariants).toHaveBeenCalledOnce();
  expect(message.ack).toHaveBeenCalledOnce();
  expect(openRealtimeRepository).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});

it("flushes events after partial task failure and closes the runtime even if realtime setup fails", async () => {
  const close = vi.fn(async () => undefined);
  vi.mocked(openCloudflareRuntime).mockResolvedValue({
    repository: { close },
    store: {},
    policy: {},
  });
  vi.mocked(processImageItem).mockRejectedValueOnce(new Error("STORAGE_UNAVAILABLE"));
  vi.mocked(openRealtimeRepository).mockImplementationOnce(() => {
    throw new Error("DB_UNAVAILABLE");
  });
  const message = {
    body: { version: 1, itemId: crypto.randomUUID() },
    ack: vi.fn(),
    retry: vi.fn(),
  };
  const env = {
    HYPERDRIVE: { connectionString: "fixture-only" },
    CLOUDFLARE_CONSUMER_ENABLED: "true",
    CLOUDFLARE_GENERATION_ENABLED: "true",
  };
  await expect(consumeCloudflareImages({ messages: [message] }, env)).rejects.toThrow(
    "DB_UNAVAILABLE",
  );
  expect(message.retry).toHaveBeenCalledExactlyOnceWith({ delaySeconds: 30 });
  expect(openRealtimeRepository).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
