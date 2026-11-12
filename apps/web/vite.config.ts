import { readFile } from "node:fs/promises";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import release from "../../release.json" with { type: "json" };

const sceneFiles = new Map([
  ["/mount.mjs", "text/javascript"],
  ["/runtime.js", "text/javascript"],
  ["/options.json", "application/json"],
  ["/scene.json", "application/json"],
  ["/assets/0134-gradient-source.jpg", "image/jpeg"],
]);

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_RELEASE_VERSION": JSON.stringify(release.version),
    "import.meta.env.VITE_APP_BUILD_TIME": JSON.stringify(Date.now()),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "local-vidmuse-scene",
      configureServer(server) {
        // 只在开发服务器提供本地参考包，避免 Vite 将采集材料复制到 dist。
        server.middlewares.use("/__vidmuse-scene", (request, response) => {
          const path = request.url?.split("?")[0] ?? "";
          const type = sceneFiles.get(path);
          if (!type || !["GET", "HEAD"].includes(request.method ?? "")) {
            response.writeHead(404).end();
            return;
          }
          const file = new URL(`./.vidmuse-scene${path}`, import.meta.url);
          void readFile(file).then(
            (bytes) => {
              response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
              response.end(request.method === "HEAD" ? undefined : bytes);
            },
            () => response.writeHead(404).end(),
          );
        });
      },
    },
    {
      name: "compose-access-urls",
      configureServer(server) {
        if (!process.env.DEV_WEB_PUBLIC_PORT) return;
        const printUrls = server.printUrls.bind(server);
        server.printUrls = () => {
          printUrls();
          server.config.logger.info(`  Web: http://localhost:${process.env.DEV_WEB_PUBLIC_PORT}/`);
          server.config.logger.info(
            `  API: http://127.0.0.1:${process.env.DEV_API_PUBLIC_PORT}/api`,
          );
        };
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: process.env.DEV_API_PROXY_TARGET ?? "http://127.0.0.1:8787", ws: true },
    },
    watch: { usePolling: process.env.DEV_USE_POLLING === "true" },
  },
  build: { target: "es2022", sourcemap: false },
});
