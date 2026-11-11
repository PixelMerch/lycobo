import assert from "node:assert/strict";
import type { StoredImage } from "@lycoboai/contracts";
import {
  imageGenerationInputSchema,
  imageUnitCredits,
  rechargeOrdersSchema,
  unwrapApiData,
  walletBalanceSchema,
  walletEntriesSchema,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { imageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { z } from "zod";
import { createApp } from "../../../api/src/app";

type Owner = Awaited<ReturnType<ImageRepository["provision"]>>;
const input = (prompt: string, count = 1) =>
  imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt, count });

export async function verifyBrowserImageSession(
  repository: ImageRepository,
  store: ReturnType<typeof imageStore>,
  first: Owner,
  second: Owner,
  asset: StoredImage,
  dispatch: () => Promise<void>,
) {
  const browserApp = createApp(undefined, {
    repository,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 1,
    validate: (value) => validateModelInput(value, {}, true),
    resolutions: supportedResolutions,
    session: { token: first.token, origins: ["http://localhost:5173"] },
  });
  assert.equal(
    (
      await browserApp.request("/api/v1/image-session", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      })
    ).status,
    401,
  );
  const login = await browserApp.request("/api/v1/image-session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(login.headers.get("set-cookie") ?? "", /SameSite=Strict/i);
  const cookieHeaders = {
    Cookie: cookie,
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
  };
  assert.equal(
    (
      await browserApp.request("/api/v1/image-tasks", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "https://attacker.example" },
        body: "{}",
      })
    ).status,
    401,
  );
  for (const model of [
    "gpt-image-2",
    "gpt-image-2-4K",
    "gpt-image-2.5",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
  ] as const) {
    const submitted = await browserApp.request("/api/v1/image-tasks", {
      method: "POST",
      headers: { ...cookieHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ ...input("browser-flow"), model }),
    });
    assert.equal(submitted.status, 202);
    const task = z.object({ id: z.uuid() }).parse(unwrapApiData(await submitted.json()));
    await dispatch();
    assert.equal((await repository.get(first, task.id))?.status, "succeeded");
  }
  const library = await browserApp.request("/api/v1/image-assets", { headers: { Cookie: cookie } });
  const saved = z
    .object({ data: z.array(z.object({ id: z.uuid(), kind: z.string() })) })
    .parse(unwrapApiData(await library.json()));
  assert.equal(saved.data.filter((asset) => asset.kind === "output").length, 7);
  assert.equal((await repository.listAssets(second, 30)).length, 0);
  const thumbnail = await browserApp.request(
    `/api/v1/image-assets/${asset.id}/content?thumbnail=1`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(thumbnail.status, 200);
  assert.equal(thumbnail.headers.get("content-type"), "image/png");
}

export async function verifyRetryRequest(
  repository: ImageRepository,
  sql: postgres.Sql,
  app: ReturnType<typeof createApp>,
  first: Owner,
  second: Owner,
  taskId: string,
  headers: Record<string, string>,
  successfulItemId: string,
  asset: StoredImage,
  dispatch: () => Promise<void>,
) {
  const retryKey = crypto.randomUUID();
  assert.equal(
    (
      await app.request(`/api/v1/image-tasks/${taskId}/retry`, {
        method: "POST",
        headers: {
          ...headers,
          Authorization: `Bearer ${second.token}`,
          "Idempotency-Key": retryKey,
        },
      })
    ).status,
    404,
  );
  const retryResponses = await Promise.all(
    Array.from({ length: 4 }, () =>
      app.request(`/api/v1/image-tasks/${taskId}/retry`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": retryKey },
      }),
    ),
  );
  assert.equal(retryResponses.filter((response) => response.status === 202).length, 1);
  assert.equal(retryResponses.filter((response) => response.status === 200).length, 3);
  const beforeRetry = await repository.get(first, taskId);
  assert.equal(beforeRetry?.items.length, 2);
  assert.equal(
    beforeRetry?.items.find((entry: { id: string }) => entry.id === successfulItemId)
      ?.output_asset_id,
    asset.id,
  );
  await dispatch();
  const afterRetry = await repository.get(first, taskId);
  assert.equal(afterRetry?.status, "succeeded");
  assert.equal(afterRetry?.items.length, 2);
  assert.equal(
    afterRetry?.items.filter((entry: { status: string }) => entry.status === "succeeded").length,
    2,
  );
  assert.equal(
    (await sql`select count(*)::int as count from generation_job_items where job_id=${taskId}`)[0]
      ?.count,
    3,
  );
}

/** 验证余额耗尽后的幂等提交与积分接口校验。 */
export async function verifyExhaustedWallet(
  repository: ImageRepository,
  app: ReturnType<typeof createApp>,
  first: Owner,
  headers: Record<string, string>,
  key: string,
) {
  // 余额归零后仍允许确认已完成扣费的原请求。
  while ((await repository.wallet(first)).balance >= imageUnitCredits) {
    const count = Math.min(
      4,
      Math.floor((await repository.wallet(first)).balance / imageUnitCredits),
    );
    await repository.create(first, input("exhaust-fixture", count), crypto.randomUUID());
  }
  assert.equal((await repository.create(first, input("mixed", 2), key, 1)).replayed, true);
  await assert.rejects(
    repository.create(first, input("no-credit"), crypto.randomUUID(), 1),
    /INSUFFICIENT_CREDITS/,
  );
  walletBalanceSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet", { headers })).json()),
  );
  walletEntriesSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet/entries", { headers })).json()),
  );
  rechargeOrdersSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet/recharges", { headers })).json()),
  );
  const spentResponse = await app.request("/api/v1/wallet/entries?view=spent&limit=1", { headers });
  const spent = walletEntriesSchema.parse(unwrapApiData(await spentResponse.json()));
  assert.equal(spent.data.length, 1);
  assert.equal(spent.data[0]?.kind, "consume");
  assert.equal((await app.request("/api/v1/wallet/entries?view=invalid", { headers })).status, 400);
  assert.equal((await app.request("/api/v1/wallet")).status, 401);
  assert.equal(
    (await app.request("/api/v1/wallet/entries?before=9999999999999999999", { headers })).status,
    400,
  );
  assert.equal(
    (
      await app.request("/api/v1/wallet/recharges", {
        method: "POST",
        headers,
        body: JSON.stringify({ credits: 10000 }),
      })
    ).status,
    404,
  );
}
