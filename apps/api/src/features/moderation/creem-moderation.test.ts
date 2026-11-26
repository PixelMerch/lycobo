import { expect, it, vi } from "vitest";
import { createCreemModerator } from "./creem-moderation";

const enabled = { CREEM_MODERATION_ENABLED: "true", CREEM_API_KEY: "creem_test_fixture" };
const signal = new AbortController().signal;
const requestId = "fixture-request-id";
const fixtureResponse = (decision: string) =>
  Response.json({ id: "mod_test", object: "moderation_result", decision });

it("keeps the switch off by default, even if a key is configured", () => {
  const request = vi.fn<typeof fetch>();
  expect(createCreemModerator({ CREEM_API_KEY: enabled.CREEM_API_KEY }, request)).toBeUndefined();
  expect(
    createCreemModerator({ ...enabled, CREEM_MODERATION_ENABLED: "false" }, request),
  ).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});

it("screens repeated batch prompts once against the API selected by the key", async () => {
  const request = vi.fn<typeof fetch>(async () => fixtureResponse("allow"));
  const moderate = createCreemModerator(enabled, request);
  expect(moderate).toBeDefined();
  await moderate?.(["white background", "white background", "natural light"], requestId, signal);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenNthCalledWith(
    1,
    "https://test-api.creem.io/v1/moderation/prompt",
    expect.objectContaining({
      method: "POST",
      redirect: "manual",
      body: JSON.stringify({ prompt: "white background", external_id: `${requestId}:1` }),
    }),
  );
});

it.each(["flag", "deny"])("blocks a %s decision", async (decision) => {
  const moderate = createCreemModerator(enabled, async () => fixtureResponse(decision));
  await expect(moderate?.(["fixture"], requestId, signal)).rejects.toMatchObject({
    code: "CONTENT_REJECTED",
  });
});

it("fails closed for missing credentials, unexpected responses and a cancelled request", async () => {
  const missing = createCreemModerator({ CREEM_MODERATION_ENABLED: "true" });
  const malformed = createCreemModerator(enabled, async () => Response.json({ decision: "allow" }));
  const errorResponse = createCreemModerator(
    enabled,
    async () => new Response(null, { status: 503 }),
  );
  for (const moderate of [missing, malformed, errorResponse])
    await expect(moderate?.(["fixture"], requestId, signal)).rejects.toMatchObject({
      code: "MODERATION_UNAVAILABLE",
    });
  const cancelled = createCreemModerator(enabled, async (_url, init) => {
    init?.signal?.throwIfAborted();
    return fixtureResponse("allow");
  });
  await expect(cancelled?.(["fixture"], requestId, AbortSignal.abort())).rejects.toMatchObject({
    code: "MODERATION_UNAVAILABLE",
  });
});
