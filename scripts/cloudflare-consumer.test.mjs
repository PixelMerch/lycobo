import { expect, it, vi } from "vitest";
import {
  consumeCloudflareImages,
  dispatchCloudflareImages,
} from "../apps/worker/src/cloudflare-consumer";
import { openCloudflareRuntime } from "../apps/worker/src/cloudflare-runtime";
import { processImageItem } from "../apps/worker/src/image-processor";

vi.mock("../apps/worker/src/cloudflare-runtime", () => ({ openCloudflareRuntime: vi.fn() }));
vi.mock("../apps/worker/src/image-processor", () => ({ processImageItem: vi.fn() }));

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
    expect(close).toHaveBeenCalledOnce();
  },
);
