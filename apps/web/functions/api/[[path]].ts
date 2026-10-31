import { businessCodes } from "@lycoboai/contracts";
import { completeApiResponse } from "../../server/api-binding-response";

interface Bindings {
  API: Fetcher;
}
// Service binding keeps cookies and Origin on Pages; R2 remains private.
export const onRequest: PagesFunction<Bindings> = async ({ request, env }) => {
  try {
    return await completeApiResponse(await env.API.fetch(request));
  } catch {
    const id = crypto.randomUUID();
    console.error({
      event: "PAGES_API_BINDING_UNAVAILABLE",
      requestId: id,
      status: 503,
      method: request.method,
    });
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
