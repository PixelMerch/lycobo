// Read finite JSON inside the binding invocation so a broken body never becomes partial success.
export async function completeApiResponse(response: Response) {
  if (!response.headers.get("Content-Type")?.includes("application/json")) return response;
  const body = await response.text();
  try {
    JSON.parse(body);
  } catch {
    console.error({
      event: "PAGES_API_INVALID_JSON",
      status: response.status,
      requestId: response.headers.get("X-Request-Id") ?? undefined,
      bytes: new TextEncoder().encode(body).byteLength,
    });
    throw new Error("API_RESPONSE_INVALID");
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  return new Response(body, { status: response.status, headers });
}
