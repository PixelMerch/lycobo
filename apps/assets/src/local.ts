import assets, { type AssetBindings } from "./index";

// Local-only entrypoint. The production resource Worker has no health route.
export default {
  async fetch(request, env, context) {
    if (new URL(request.url).pathname === "/health") return new Response(null, { status: 204 });
    return assets.fetch(request, env, context);
  },
} satisfies ExportedHandler<AssetBindings>;
