import { imageDeliverySchema, imageSessionResponseSchema } from "@lycoboai/contracts";
import { queryClient } from "../../lib/query-client";

const prefix = "lycobo-preview-links-v1:";
type Delivery = ReturnType<typeof imageDeliverySchema.parse>;

export function samePreview(a: string, b: string) {
  const before = new URL(a),
    after = new URL(b);
  return (
    before.origin === after.origin &&
    before.pathname === after.pathname &&
    before.searchParams.get("variant") === after.searchParams.get("variant")
  );
}

/** Only reuse after fresh authorized metadata confirms this asset and its current serving path. */
export function reusePreviewLinks(id: string, incoming: Delivery): Delivery {
  const scope = imageSessionResponseSchema.safeParse(queryClient.getQueryData(["image-session"]));
  if (!scope.success) return incoming;
  try {
    const key = `${prefix}${scope.data.organizationId}:${scope.data.userId}`;
    const raw: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    const entries = Array.isArray(raw) ? raw.slice(-200) : [];
    const valid: { id: string; url: string; thumbnail_url: string; expires_at: number }[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || typeof entry.id !== "string") continue;
      const parsed = imageDeliverySchema.safeParse({
        ...entry,
        download_url: incoming.download_url,
      });
      if (parsed.success && parsed.data.expires_at > Date.now() / 1000 + 60)
        valid.push({
          id: entry.id,
          url: parsed.data.url,
          thumbnail_url: parsed.data.thumbnail_url,
          expires_at: parsed.data.expires_at,
        });
    }
    const previous = valid.find((entry) => entry.id === id);
    const result =
      previous &&
      samePreview(previous.url, incoming.url) &&
      samePreview(previous.thumbnail_url, incoming.thumbnail_url)
        ? {
            ...incoming,
            url: previous.url,
            thumbnail_url: previous.thumbnail_url,
            expires_at: previous.expires_at,
          }
        : incoming;
    sessionStorage.setItem(
      key,
      JSON.stringify([
        ...valid.filter((entry) => entry.id !== id).slice(-199),
        { id, url: result.url, thumbnail_url: result.thumbnail_url, expires_at: result.expires_at },
      ]),
    );
    return result;
  } catch {
    return incoming;
  }
}

export function clearPreviewLinks() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
}
