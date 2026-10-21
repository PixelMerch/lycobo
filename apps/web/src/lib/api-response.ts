import { unwrapApiData } from "@lycoboai/contracts";
/** Normalize JSON data once at the HTTP boundary; downloads keep their original response. */
export async function normalizeApiResponse(response: Response) {
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json"))
    return response;
  const data = unwrapApiData(await response.json());
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(JSON.stringify(data), { status: response.status, headers });
}
