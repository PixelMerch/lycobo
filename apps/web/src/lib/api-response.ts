import { unwrapApiData } from "@lycoboai/contracts";
import { currentMessages } from "../i18n/messages";
import { libMessages } from "./lib-messages";

/** 在 HTTP 边界统一拆开 JSON 响应的数据；下载类响应保持原样。 */
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
    throw new Error(currentMessages(libMessages).incompleteResponse);
  }
  const data = unwrapApiData(payload);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(JSON.stringify(data), { status: response.status, headers });
}
