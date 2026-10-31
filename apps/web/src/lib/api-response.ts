import { unwrapApiData } from "@lycoboai/contracts";
/** Normalize JSON data once at the HTTP boundary; downloads keep their original response. */
export async function normalizeApiResponse(response: Response) {
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json"))
    return response;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    const id = response.headers.get("X-Request-Id");
    console.error({
      event: "API_RESPONSE_INVALID_JSON",
      status: response.status,
      ...(id && /^[0-9a-f-]{36}$/i.test(id) ? { requestId: id } : {}),
    });
    throw new Error("响应未完整接收，请重试查询；已提交的任务请勿重复生成");
  }
  const data = unwrapApiData(payload);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(JSON.stringify(data), { status: response.status, headers });
}
