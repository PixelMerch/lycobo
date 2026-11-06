import { expect, it, vi } from "vitest";
import { createApp } from "../apps/api/src/app";
import { serveCloudflareApi } from "../apps/api/src/cloudflare-app";
import { openCloudflareRuntime } from "../apps/worker/src/cloudflare-runtime";
import { openAuthRepository } from "../packages/db/src/index";

vi.mock("../apps/api/src/app", () => ({ createApp: vi.fn() }));
vi.mock("../apps/worker/src/cloudflare-runtime", () => ({ openCloudflareRuntime: vi.fn() }));
vi.mock("../packages/db/src/index", async (importOriginal) => ({
  ...(await importOriginal()),
  openAuthRepository: vi.fn(),
  openRealtimeRepository: () => ({ pending: async () => [], close: async () => undefined }),
}));

it.each([true, false])(
  "mounts the signed receiver with generation enabled = %s",
  async (enabled) => {
    const close = vi.fn(async () => undefined);
    const repository = { close };
    vi.mocked(openAuthRepository).mockReturnValue({ close });
    vi.mocked(openCloudflareRuntime).mockResolvedValue({ repository, policy: {} });
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.mocked(createApp).mockReturnValue({ fetch });
    const env = {
      AUTH_JWT_SECRET: "fixture-auth-secret-with-at-least-32-characters",
      AUTH_TRUSTED_ORIGINS: "https://fixture.example",
      HYPERDRIVE: { connectionString: "fixture-only" },
      IMAGE_WEBHOOK_SECRET: "fixture-webhook-secret-only",
      IMAGE_WEBHOOK_ENABLED: "true",
      STANDALONE_IMAGE_API_KEY: "fixture-image-key",
      DEEPSEEK_API_KEY: "fixture-text-key",
      ASSET_PUBLIC_ORIGIN: "https://media.fixture.example",
      ASSET_SIGNING_SECRET: "fixture-asset-secret-with-at-least-32-characters",
      ASSET_PATH_PREFIX: "/images/",
      CLOUDFLARE_CONSUMER_ENABLED: "true",
      CLOUDFLARE_GENERATION_ENABLED: String(enabled),
    };
    const response = await serveCloudflareApi(
      new Request("https://fixture.example/api/v1/webhooks/fluxport/images"),
      env,
    );
    expect(response.status).toBe(204);
    const [, images, , webhook] = vi.mocked(createApp).mock.calls.at(-1);
    expect(webhook.secret).toBe(env.IMAGE_WEBHOOK_SECRET);
    expect(webhook.source).toMatch(/^[a-f0-9]{64}$/);
    expect(webhook.source).not.toBe(env.STANDALONE_IMAGE_API_KEY);
    expect(images.enabled).toBe(enabled);
    expect(images.plannerKey).toBe(enabled ? env.DEEPSEEK_API_KEY : undefined);
    expect(close).toHaveBeenCalledTimes(2);
  },
);

it("keeps database clients open until the streaming response finishes", async () => {
  const close = vi.fn(async () => undefined);
  vi.mocked(openAuthRepository).mockReturnValue({ close });
  vi.mocked(openCloudflareRuntime).mockResolvedValue({ repository: { close }, policy: {} });
  const { promise, resolve } = Promise.withResolvers();
  const body = new ReadableStream({
    async start(controller) {
      await promise;
      controller.enqueue(new TextEncoder().encode("event: complete\ndata: {}\n\n"));
      controller.close();
    },
  });
  vi.mocked(createApp).mockReturnValue({
    fetch: async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
  });
  const env = {
    AUTH_JWT_SECRET: "fixture-auth-secret-with-at-least-32-characters",
    AUTH_TRUSTED_ORIGINS: "https://fixture.example",
    HYPERDRIVE: { connectionString: "fixture-only" },
    ASSET_PUBLIC_ORIGIN: "https://media.fixture.example",
    ASSET_SIGNING_SECRET: "fixture-asset-secret-with-at-least-32-characters",
  };
  const response = await serveCloudflareApi(new Request("https://fixture.example/api/stream"), env);
  expect(close).not.toHaveBeenCalled();
  const text = response.text();
  resolve();
  expect(await text).toContain("event: complete");
  expect(close).toHaveBeenCalledTimes(2);
});
