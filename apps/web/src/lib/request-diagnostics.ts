/** Diagnostic metadata only: never include cookies, bodies, prompts or URL queries. */
export function reportRequestFailure(path: string, method: string, response?: Response) {
  if (response?.ok || (response?.status === 401 && method === "GET")) return;
  const requestId = response?.headers.get("X-Request-Id");
  console.error({
    event: response ? "API_REQUEST_FAILED" : "API_NETWORK_FAILED",
    method,
    path: path.split("?")[0]?.replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ":id"),
    status: response?.status ?? 0,
    ...(requestId && /^[0-9a-f-]{36}$/i.test(requestId) ? { requestId } : {}),
  });
}
