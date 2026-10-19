import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.DEV_API_PROXY_TARGET ?? "http://127.0.0.1:8787" },
    watch: { usePolling: process.env.DEV_USE_POLLING === "true" },
  },
  build: { target: "es2022", sourcemap: false },
});
