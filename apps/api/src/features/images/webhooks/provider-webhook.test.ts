import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import { providerWebhookRoutes, readWebhookConfig, verifyWebhook } from "./provider-webhook";

const secret = "isolated-webhook-secret-only";
function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  return new Headers({
    "X-FluxPort-Webhook-Timestamp": timestamp,
    "X-FluxPort-Webhook-Signature": `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`,
    "X-FluxPort-Event-ID": "evt_fixture",
    "Idempotency-Key": "evt_fixture",
    "X-FluxPort-Event-Type": "image.task.completed",
  });
}
const body = JSON.stringify({
  id: "evt_fixture",
  object: "event",
  type: "image.task.completed",
  data: {
    task: {
      task_id: "imgtask_fixture",
      status: "success",
      result_url: "https://untrusted.invalid/result",
    },
  },
});
it("verifies exact bytes and rejects tampering, stale delivery and malformed signatures", () => {
  const bytes = new TextEncoder().encode(body);
  expect(verifyWebhook(bytes, signed(body), secret)).toBe(true);
  expect(verifyWebhook(new TextEncoder().encode(`${body} `), signed(body), secret)).toBe(false);
  expect(verifyWebhook(bytes, signed(body, "1000000000"), secret)).toBe(false);
  const headers = signed(body);
  headers.set("X-FluxPort-Webhook-Signature", "v1=bad");
  expect(verifyWebhook(bytes, headers, secret)).toBe(false);
});
it("persists only identifiers before waking and acknowledges an early or duplicate receipt", async () => {
  const receive = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const wake = vi.fn(async () => {
    expect(receive).toHaveBeenCalledTimes(1);
  });
  const app = providerWebhookRoutes({
    config: { secret, source: "a".repeat(64) },
    repository: { webhookReceive: receive },
    wake,
  });
  for (let i = 0; i < 2; i++)
    expect(
      (await app.request("/fluxport/images", { method: "POST", body, headers: signed(body) }))
        .status,
    ).toBe(200);
  expect(wake).toHaveBeenCalledTimes(1);
  expect(receive).toHaveBeenCalledWith({
    source: "a".repeat(64),
    eventId: "evt_fixture",
    taskId: "imgtask_fixture",
    eventType: "image.task.completed",
    taskStatus: "success",
  });
});
it("rejects unsigned and header-conflicting events before database access", async () => {
  const receive = vi.fn();
  const app = providerWebhookRoutes({
    config: { secret, source: "a".repeat(64) },
    repository: { webhookReceive: receive },
  });
  expect((await app.request("/fluxport/images", { method: "POST", body })).status).toBe(401);
  const headers = signed(body);
  headers.set("Idempotency-Key", "another-event");
  expect((await app.request("/fluxport/images", { method: "POST", body, headers })).status).toBe(
    400,
  );
  expect(receive).not.toHaveBeenCalled();
});
it("leaves receiver disabled without a secret and requires a source key when enabled", () => {
  expect(readWebhookConfig({})).toBeUndefined();
  expect(() => readWebhookConfig({ IMAGE_WEBHOOK_SECRET: secret })).toThrow("WEBHOOK_KEY_REQUIRED");
});
