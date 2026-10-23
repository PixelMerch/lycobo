import { businessCodes } from "@lycoboai/contracts";

interface Bindings {
  API: Fetcher;
}
// Service binding keeps cookies and Origin on Pages; R2 remains private.
export const onRequest: PagesFunction<Bindings> = async ({ request, env }) => {
  try {
    return await env.API.fetch(request);
  } catch {
    const id = crypto.randomUUID();
    return Response.json(
      {
        request_id: id,
        code: businessCodes.INTERNAL_ERROR,
        message: "服务暂时不可用",
        data: {},
        error: { code: "INTERNAL_ERROR" },
      },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Request-Id": id } },
    );
  }
};
