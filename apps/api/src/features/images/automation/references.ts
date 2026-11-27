import {
  automationReferenceLimits,
  automationReferenceSha256,
  imageAutomationReferenceUploadPath,
} from "@lycoboai/contracts";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import { ImageValidationError } from "@lycoboai/storage/core";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { checkImageRequestLimit } from "../rate-limit";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";

const uploadContext = "image-automation-reference-upload:v1";
const uploadLifetimeMs = 10 * 60 * 1000;
const uploadClaim = z.strictObject({
  userId: id,
  organizationId: id,
  sha256: automationReferenceSha256,
  expiresAt: z.number().int(),
});

/** 用企业连接器批量查重，仅为未命中的指纹签发短期上传凭证。 */
export async function prepareAutomationReferences(
  c: Context<Env>,
  { repository, store, automationKeySecret, uploadsEnabled }: ImageApiDependencies,
  fingerprints: string[],
) {
  if (!automationKeySecret || !store.putAutomationReference || uploadsEnabled === false)
    return fail(c, "GENERATION_NOT_CONFIGURED", "自动化参考图上传暂不可用", 503);
  const { userId, organizationId } = c.get("principal");
  const scope = { userId, organizationId };
  const assets = await repository.automationReferences(scope, fingerprints);
  const matches = new Map(assets.map(({ sha256, assetId }) => [sha256, assetId]));
  const uploadUrl = new URL(`/api/v1${imageAutomationReferenceUploadPath}`, c.req.url).href;
  const expiresAt = Date.now() + uploadLifetimeMs;
  const references = await Promise.all(
    fingerprints.map(async (sha256) => {
      const assetId = matches.get(sha256);
      if (assetId) return { sha256, assetId };
      const claim = JSON.stringify({ ...scope, sha256, expiresAt });
      return {
        sha256,
        uploadUrl,
        uploadToken: await sealProviderKey(claim, automationKeySecret, uploadContext),
      };
    }),
  );
  return c.json({ references });
}

async function readUploadClaim(token: string | undefined, secret: string) {
  if (!token || token.length > 700 || !token.startsWith("Bearer ")) return null;
  try {
    const plaintext = await openProviderKey(token.slice(7), secret, uploadContext);
    const claim = uploadClaim.safeParse(JSON.parse(plaintext));
    return claim.success && claim.data.expiresAt > Date.now() ? claim.data : null;
  } catch {
    return null;
  }
}

const tooLarge = (c: Context<Env>) => fail(c, "PAYLOAD_TOO_LARGE", "参考图不得超过 1 MiB", 413);

async function saveAutomationReference(
  c: Context<Env>,
  claim: z.infer<typeof uploadClaim>,
  { repository, store }: ImageApiDependencies,
  put: NonNullable<ImageApiDependencies["store"]["putAutomationReference"]>,
) {
  const [existing] = await repository.automationReferences(claim, [claim.sha256]);
  if (existing) return c.json({ assetId: existing.assetId });
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > automationReferenceLimits.maxBytes) return tooLarge(c);
  try {
    const asset = await put(claim, bytes);
    // 落库异常时提交结果可能未知，仅在确认得到其他素材 ID 后清理本次竞争副本。
    const assetId = await repository.addAutomationReference(claim, claim.sha256, asset);
    if (assetId !== asset.id)
      await store.remove(asset).catch(() => {
        console.warn("AUTOMATION_REFERENCE_CLEANUP_FAILED", asset.id);
      });
    return c.json({ assetId }, assetId === asset.id ? 201 : 200);
  } catch (error) {
    if (!(error instanceof ImageValidationError)) throw error;
    return fail(c, "INVALID_IMAGE", "参考图必须为有效的静态 WebP，最长边不得超过 1600 像素", 400);
  }
}

/** 在企业 Key 中间件前注册仅接受短期凭证的原始 WebP 上传。 */
export function registerAutomationReferenceUpload(app: Hono<Env>, deps: ImageApiDependencies) {
  const limitBody = bodyLimit({ maxSize: automationReferenceLimits.maxBytes, onError: tooLarge });
  app.put(imageAutomationReferenceUploadPath, async (c) => {
    const { automationKeySecret, rateLimits, uploadsEnabled } = deps;
    const put = deps.store.putAutomationReference;
    if (!automationKeySecret || !put || uploadsEnabled === false)
      return fail(c, "GENERATION_NOT_CONFIGURED", "自动化参考图上传暂不可用", 503);
    const claim = await readUploadClaim(c.req.header("Authorization"), automationKeySecret);
    if (!claim) return fail(c, "UNAUTHORIZED", "上传凭证无效或已过期，请重新查重", 401);
    if (rateLimits) {
      const limited = await checkImageRequestLimit(c, rateLimits, claim.userId, "upload");
      if (limited) return limited;
    }
    if (c.req.header("Content-Type") !== "image/webp")
      return fail(c, "INVALID_IMAGE", "参考图必须为 WebP", 400);
    return limitBody(c, async () => {
      c.res = await saveAutomationReference(c, claim, deps, put);
    });
  });
}
