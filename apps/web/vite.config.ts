import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
    proxy: { "/api": process.env.DEV_API_PROXY_TARGET ?? "http://127.0.0.1:8787" },
    watch: { usePolling: process.env.DEV_USE_POLLING === "true" },
  },
  build: { target: "es2022", sourcemap: false },
});
