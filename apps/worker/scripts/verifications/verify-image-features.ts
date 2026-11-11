import type { ImageRepository } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import type { createApp } from "../../../api/src/app";
import { verifyAssetLibrary } from "./verify-asset-library";
import { verifyCloudflareIsolation } from "./verify-cloudflare-isolation";
import { verifyLocalEdits } from "./verify-local-edits";
import { verifyManagedModels } from "./verify-managed-models";
import { verifyRealtime } from "./verify-realtime";
import { verifyReferenceRetention } from "./verify-reference-retention";
import { verifyReferenceWaiting } from "./verify-reference-waiting";
import { verifyReplica } from "./verify-replica";
import { verifyStandaloneModels } from "./verify-standalone-models";
import { verifyTextileGeneration } from "./verify-textile-generation";
import { verifyVariationPlans } from "./verify-variation-plans";
import { verifyVideos } from "./verify-videos";
import { verifyWallet } from "./verify-wallet";

/** 在隔离数据库中验证图片任务、账务、存储和回调链路。 */
export async function verifyImageFeatures(
  databaseUrl: string,
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Buffer,
  app: ReturnType<typeof createApp>,
) {
  await verifyCloudflareIsolation(databaseUrl, sql, store, png);
  await verifyStandaloneModels(databaseUrl, sql, store, png);
  await verifyManagedModels(repository, sql, store, png);
  await verifyReplica(repository, store, png);
  await verifyReferenceWaiting(repository, sql, store, png);
  await verifyReferenceRetention(repository, sql);
  await verifyVariationPlans(repository, sql, store, png);
  await verifyWallet(repository, sql);
  await verifyRealtime(databaseUrl, repository, sql);
  await verifyVideos(repository, sql);
  await verifyTextileGeneration(repository, sql, store, png);
  await verifyLocalEdits(repository, sql, async (path, init) => app.request(path, init));
  await verifyAssetLibrary(repository, sql);
}
