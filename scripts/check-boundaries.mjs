import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const serverPackages = /@lycoboai\/(db|queue|generation|storage)(?:[/"']|$)/;
let failed = false;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(file)) {
      const text = await readFile(file, "utf8");
      if (
        serverPackages.test(text) ||
        /(?:from\s*|import\s*\()\s*["'](?:node:|[^"']*apps\/(?:api|worker)\/|[^"']*packages\/(?:db|queue|generation|storage)\/)/.test(
          text,
        )
      ) {
        console.error("Server-only dependency in browser source:", file);
        failed = true;
      }
    }
  }
}
await walk("apps/web/src");
const web = JSON.parse(await readFile("apps/web/package.json", "utf8"));
for (const dependency of Object.keys(web.dependencies ?? {})) {
  if (serverPackages.test(dependency)) {
    console.error("Server dependency in web manifest:", dependency);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
