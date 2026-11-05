/** Only fixed categories reach logs; exception messages can contain SQL or credentials. */
export function errorCategory(error: unknown) {
  const names = new Set([
    "Error",
    "TypeError",
    "RangeError",
    "SyntaxError",
    "AbortError",
    "TimeoutError",
    "PostgresError",
    "ZodError",
    "HTTPException",
  ]);
  const codes = new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EPIPE",
    "08000",
    "08001",
    "08003",
    "08006",
    "08004",
    "23502",
    "23503",
    "23505",
    "40001",
    "40P01",
    "53300",
    "53400",
    "57014",
    "57P01",
    "57P02",
    "57P03",
  ]);
  const source = typeof error === "object" && error !== null ? error : {};
  const name =
    "name" in source && typeof source.name === "string" && names.has(source.name)
      ? source.name
      : "Error";
  const code =
    "code" in source && typeof source.code === "string" && codes.has(source.code)
      ? source.code
      : undefined;
  return { name, ...(code ? { errorCode: code } : {}) };
}

export function safeRequestPath(request: Request) {
  const parts = new URL(request.url).pathname.split("/");
  // Never log query strings, arbitrary unmatched paths, credentials or asset keys.
  const allowed = new Set([
    "api",
    "v1",
    "health",
    "live",
    "auth",
    "enterprise",
    "login",
    "logout",
    "refresh",
    "session",
    "password",
    "image-tasks",
    "image-assets",
    "image-events",
    "image-models",
    "image-model-logos",
    "image-session",
    "variation-plans",
    "capabilities",
    "retry",
    "content",
    "latest-edit",
    "favorite",
    "wallet",
    "entries",
    "orders",
    "recharge",
    "checkin",
    "system",
  ]);
  return parts
    .map((part, index) => {
      if (index === 0) return "";
      return allowed.has(part) ? part : ":id";
    })
    .slice(0, 7)
    .join("/");
}
