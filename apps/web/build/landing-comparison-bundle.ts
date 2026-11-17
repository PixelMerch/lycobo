import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { build, type Plugin } from "vite";

const moduleId = "virtual:landing-comparison-client";
const webRoot = fileURLToPath(new URL("../", import.meta.url));
const entry = fileURLToPath(new URL("./landing-comparison-client.tsx", import.meta.url));
const source = new URL("../src/features/home/landing/", import.meta.url);

async function bundleComparison() {
  const built = await build({
    configFile: false,
    root: webRoot,
    mode: "production",
    logLevel: "error",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [tailwindcss()],
    oxc: { jsx: { runtime: "automatic", development: false } },
    build: {
      write: false,
      minify: true,
      target: "es2022",
      cssCodeSplit: false,
      lib: { entry, formats: ["iife"], name: "LycoboLandingComparison" },
    },
  });
  if (!Array.isArray(built)) throw new Error("Landing comparison bundle did not emit files");
  const files = built.flatMap((result) => result.output);
  const script = files.find((file) => file.type === "chunk" && file.isEntry);
  const style = files.find((file) => file.type === "asset" && file.fileName.endsWith(".css"));
  if (script?.type !== "chunk" || style?.type !== "asset") {
    throw new Error("Landing comparison bundle is missing scripts or styles");
  }
  return { script: script.code, css: String(style.source) };
}

/** 将对比组件打包为隔离首页可内嵌的脚本和样式，复用现有资源限制。 */
export function landingComparisonBundle(): Plugin {
  return {
    name: "lycobo-landing-comparison-bundle",
    resolveId(id) {
      if (id === moduleId) return `\0${id}`;
    },
    async load(id) {
      if (id !== `\0${moduleId}`) return;
      this.addWatchFile(entry);
      this.addWatchFile(fileURLToPath(new URL("landing-image-comparison.tsx", source)));
      this.addWatchFile(fileURLToPath(new URL("landing-comparison-utilities.css", source)));
      return `export default ${JSON.stringify(await bundleComparison())};`;
    },
  };
}
