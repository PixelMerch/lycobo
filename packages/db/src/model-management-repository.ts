import {
  channelInputSchema,
  type ImageGenerationInput,
  imageModelCatalog,
  imageModelLogosResponseSchema,
  modelRouteInputSchema,
  providerSnapshotSchema,
  publicImageModel,
  publicImageModelIds,
} from "@lycoboai/contracts";
import type postgres from "postgres";

export function modelManagementRepository(sql: postgres.Sql) {
  const audit = (tx: postgres.TransactionSql, actor: string, action: string, id: string) =>
    tx`insert into model_audit_events (actor_id,action,resource_id) values (${actor},${action},${id})`;
  return {
    async logos() {
      // Explicit legacy catalog identities; never infer identity from display names.
      const identities = {
        "gpt-image-2": ["gpt-image-2"],
        "gpt-image-2.5": ["gpt-image-2.5"],
        "nano-banana-2.1": [
          "nano-banana-2.1",
          "gemini-nano-banana-2.1",
          "gemini-3.1-flash-image-preview",
        ],
      };
      const rows =
        await sql`select code,name,logo_url,description,capability_summary,sort_order from model_catalog where category='image' and code in ${sql(Object.values(identities).flat())}`;
      return imageModelLogosResponseSchema.parse({
        models: publicImageModelIds
          .map((id) => {
            const entries = identities[id].map((code) => rows.find((row) => row.code === code));
            // Prefer the configured Logo entry so legacy catalog names/copy stay together.
            const entry =
              entries.find((row) => row?.logo_url != null) ?? entries.find((row) => row != null);
            return {
              id,
              sortOrder: entry?.sort_order ?? 2147483647,
              name: entry?.name ?? id,
              logoUrl: entry?.logo_url ?? null,
              description: entry?.description ?? "",
              capabilitySummary: entry?.capability_summary ?? "",
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder),
      });
    },
    async list() {
      const [providers, channels, routes] = await Promise.all([
        sql`select id,name,origin,adapter,enabled=1 as enabled,true as key_configured,updated_at from model_providers order by created_at`,
        sql`select id,provider_id,name,model,settings,enabled=1 as enabled from model_channels order by created_at`,
        sql`select tool,model,channel_id from model_routes order by tool,model`,
      ]);
      return { providers, channels, routes };
    },
    async saveProvider(
      actor: string,
      id: string | undefined,
      input: { name: string; origin: string; adapter: string; enabled: boolean },
      ciphertext?: string,
    ) {
      return sql.begin(async (tx) => {
        let credentialId: string | undefined;
        if (ciphertext) {
          const [key] =
            await tx`insert into model_credentials (ciphertext) values (${ciphertext}) returning id`;
          credentialId = String(key?.id);
        }
        if (id) {
          const [row] =
            await tx`update model_providers set name=${input.name},origin=${input.origin},adapter=${input.adapter},enabled=${Number(input.enabled)},credential_id=coalesce(${credentialId ?? null},credential_id),updated_at=now() where id=${id} returning id`;
          if (!row) throw new Error("NOT_FOUND");
        } else {
          if (!credentialId) throw new Error("KEY_REQUIRED");
          const [row] =
            await tx`insert into model_providers(name,origin,adapter,credential_id,enabled) values (${input.name},${input.origin},${input.adapter},${credentialId},${Number(input.enabled)}) returning id`;
          id = String(row?.id);
        }
        await audit(tx, actor, "provider.save", id);
        return { id };
      });
    },
    async saveChannel(actor: string, id: string | undefined, value: unknown) {
      const input = channelInputSchema.parse(value);
      return sql.begin(async (tx) => {
        if (id) {
          const rows =
            await tx`update model_channels set name=${input.name},provider_id=${input.providerId},model=${input.model},settings=${tx.json(input)},enabled=${Number(input.enabled)} where id=${id} returning id`;
          if (!rows.length) throw new Error("NOT_FOUND");
        } else {
          const [row] =
            await tx`insert into model_channels(name,provider_id,model,settings,enabled) values (${input.name},${input.providerId},${input.model},${tx.json(input)},${Number(input.enabled)}) returning id`;
          id = String(row?.id);
        }
        await audit(tx, actor, "channel.save", id);
        return { id };
      });
    },
    async saveRoute(actor: string, value: unknown) {
      const input = modelRouteInputSchema.parse(value);
      return sql.begin(async (tx) => {
        const rows =
          await tx`select id from model_channels where id=${input.channelId} and model=${input.model}`;
        if (!rows.length) throw new Error("CHANNEL_MODEL_MISMATCH");
        await tx`insert into model_routes(tool,model,channel_id) values (${input.tool},${input.model},${input.channelId}) on conflict(tool,model) do update set channel_id=excluded.channel_id`;
        await audit(tx, actor, "route.save", input.channelId);
        return { saved: true };
      });
    },
    async hasRoute(input: ImageGenerationInput) {
      const tool = input.textileSet ? "textile-set" : input.localEdit ? "local-edit" : "create";
      const rows =
        await sql`select tool from model_routes where tool=${tool} and model=${publicImageModel(input.model)}`;
      return rows.length > 0;
    },
    async capabilities() {
      const [rows, catalog] = await Promise.all([
        sql`select r.tool,r.model,c.settings,c.enabled,p.enabled as provider_enabled,m.enabled as catalog_enabled,m.category as catalog_category,k.enabled as key_enabled from model_routes r join model_channels c on c.id=r.channel_id join model_providers p on p.id=c.provider_id left join model_catalog m on m.code=c.model left join model_provider_keys k on k.id=c.key_id`,
        sql`select code,category,enabled from model_catalog`,
      ]);
      return Object.fromEntries(
        ["create", "textile-set", "local-edit"].map((tool) => [
          tool,
          imageModelCatalog.map((model) => {
            const row = rows.find((r) => r.tool === tool && r.model === model.id);
            const configuredModel = catalog.find((entry) => entry.code === model.id);
            if (
              configuredModel &&
              (configuredModel.enabled !== 1 || configuredModel.category !== "image")
            )
              return {
                id: model.id,
                enabledResolutions: [],
                editsEnabled: false,
                managed: true,
                maxReferences: 0,
              };
            if (!row)
              return {
                id: model.id,
                enabledResolutions: model.allowedResolutions,
                editsEnabled: true,
                managed: false,
                maxReferences: 10,
              };
            const settings = channelInputSchema.parse(row.settings);
            return {
              id: model.id,
              enabledResolutions:
                row.enabled === 1 &&
                row.provider_enabled === 1 &&
                row.catalog_enabled !== 0 &&
                row.key_enabled !== 0
                  ? settings.resolutions
                  : [],
              editsEnabled: settings.editsEnabled,
              managed: true,
              maxReferences: settings.maxReferences,
            };
          }),
        ]),
      );
    },
    async provider(id: string) {
      const [row] =
        await sql`select p.origin,c.ciphertext from model_providers p join model_credentials c on c.id=p.credential_id where p.id=${id}`;
      return row ? { origin: String(row.origin), ciphertext: String(row.ciphertext) } : null;
    },
  };
}
// Used inside task creation: snapshot routing, never credentials, before reserving credits.
export async function resolveProviderSnapshot(
  tx: postgres.TransactionSql,
  input: ImageGenerationInput,
) {
  const tool = input.textileSet ? "textile-set" : input.localEdit ? "local-edit" : "create";
  const [catalog] =
    await tx`select enabled,category from model_catalog where code=${publicImageModel(input.model)}`;
  if (catalog && (catalog.enabled !== 1 || catalog.category !== "image"))
    throw new Error("MODEL_CHANNEL_DISABLED");
  const [row] =
    await tx`select c.id,c.settings,c.enabled,p.enabled as provider_enabled,p.origin,p.adapter,coalesce(k.credential_id,p.credential_id) as credential_id,k.enabled as key_enabled,m.enabled as catalog_enabled from model_routes r join model_channels c on c.id=r.channel_id join model_providers p on p.id=c.provider_id left join model_provider_keys k on k.id=c.key_id left join model_catalog m on m.code=c.model where r.tool=${tool} and r.model=${publicImageModel(input.model)}`;
  if (!row) {
    if (input.textileSet && input.textileSet.version >= 5)
      throw new Error("MODEL_CHANNEL_DISABLED");
    return null;
  }
  if (
    row.enabled !== 1 ||
    row.provider_enabled !== 1 ||
    row.key_enabled === 0 ||
    row.catalog_enabled === 0
  )
    throw new Error("MODEL_CHANNEL_DISABLED");
  const settings = channelInputSchema.parse(row.settings);
  if (
    !settings.resolutions.includes(input.resolution) ||
    input.referenceAssetIds.length > settings.maxReferences ||
    (input.referenceAssetIds.length > 0 && !settings.editsEnabled)
  )
    throw new Error("MODEL_CHANNEL_CAPABILITY");
  const { name: _name, providerId: _providerId, enabled: _enabled, ...configuration } = settings;
  return providerSnapshotSchema.parse({
    ...configuration,
    channelId: row.id,
    credentialId: row.credential_id,
    origin: row.origin,
    adapter: row.adapter,
  });
}
