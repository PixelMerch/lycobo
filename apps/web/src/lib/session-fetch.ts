// Only expiry metadata lives in JavaScript. Both credentials remain HttpOnly cookies.
let accessExpiresAt = Number.POSITIVE_INFINITY;
let renewal: Promise<boolean> | undefined;
let controller: AbortController | undefined;
const renewBeforeSeconds = 5 * 60;
function readExpiry(response: Response) {
  const value = Number(response.headers.get("X-Auth-Expires-At"));
  if (value > 0 && Number.isFinite(value)) accessExpiresAt = value;
}
export function resetSessionRenewal() {
  controller?.abort();
  controller = undefined;
  renewal = undefined;
  accessExpiresAt = Number.POSITIVE_INFINITY;
}
export function rememberSessionExpiry(response: Response) {
  readExpiry(response);
}
async function refreshSession() {
  if (renewal) return renewal;
  const active = new AbortController();
  controller = active;
  const renew = async () => {
    const init = {
      credentials: "same-origin",
      signal: AbortSignal.any([active.signal, AbortSignal.timeout(15000)]),
    } as const;
    // Another tab may already have refreshed while this tab waited for the lock.
    const current = await fetch("/api/v1/auth/session", init);
    readExpiry(current);
    if (current.ok && accessExpiresAt > Date.now() / 1000 + renewBeforeSeconds) return true;
    const response = await fetch("/api/v1/auth/refresh", { ...init, method: "POST" });
    readExpiry(response);
    if (response.ok) return true;
    if (response.status === 401) {
      // Covers concurrent rotation in browsers without Web Locks; keep the winning cookie.
      const latest = await fetch("/api/v1/auth/session", init);
      readExpiry(latest);
      return latest.ok;
    }
    return false;
  };
  const pending = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks)
      return await navigator.locks.request(
        "lycobo-enterprise-refresh",
        { signal: active.signal },
        renew,
      );
    return await renew();
  })().finally(() => {
    if (renewal === pending) {
      renewal = undefined;
      controller = undefined;
    }
  });
  renewal = pending;
  return pending;
}
export async function sessionFetch(input: string, init: RequestInit = {}) {
  if (accessExpiresAt <= Date.now() / 1000 + renewBeforeSeconds) await refreshSession();
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  readExpiry(response);
  if (response.status !== 401 || init.signal?.aborted) return response;
  if (!(await refreshSession())) return response;
  // A 401 is returned before business work; preserve the original body and idempotency key.
  const retried = await fetch(input, { ...init, credentials: "same-origin" });
  readExpiry(retried);
  return retried;
}
