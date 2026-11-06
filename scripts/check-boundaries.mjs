import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPackages = /@lycoboai\/(db|queue|generation|storage)(?:[/"']|$)/;
// 只检查运行源代码和依赖声明，防止已移除的平台被当作备用路径重新接入。
const retiredRuntime =
  /@cloudbase\/|tcloudbasegateway\.com|\b(?:CLOUDBASE|TCB|TENCENTCLOUD)_[A-Z_]+/i;
const serverImport =
  /(?:from\s*|import\s*\()\s*["'](?:node:|[^"']*apps\/(?:api|worker)\/|[^"']*packages\/(?:db|queue|generation|storage)\/)/;

/** 返回源文件的运行时边界问题，不输出代码正文或配置值。 */
export function sourceBoundaryProblems(file, text) {
  const problems = [];
  if (retiredRuntime.test(text)) problems.push("RETIRED_RUNTIME_REFERENCE");
  if (file.startsWith("apps/web/src/") && (serverPackages.test(text) || serverImport.test(text)))
    problems.push("SERVER_DEPENDENCY_IN_BROWSER");
  return problems;
}

async function inspectSource(dir, problems) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await inspectSource(file, problems);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(file)) {
      const text = await readFile(file, "utf8");
      for (const code of sourceBoundaryProblems(file, text)) problems.push({ file, code });
    }
  }
}
async function inspectManifest(file, problems) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  for (const name of Object.keys(dependencies)) {
    if (retiredRuntime.test(name)) problems.push({ file, code: "RETIRED_RUNTIME_DEPENDENCY" });
    if (file === "apps/web/package.json" && serverPackages.test(name))
      problems.push({ file, code: "SERVER_DEPENDENCY_IN_BROWSER" });
  }
}
async function inspectWorkspace(workspace, problems) {
  await inspectManifest(path.join(workspace, "package.json"), problems);
  const folders = await readdir(workspace, { withFileTypes: true });
  const sources = folders.filter(
    (folder) => folder.isDirectory() && ["src", "scripts"].includes(folder.name),
  );
  for (const folder of sources) await inspectSource(path.join(workspace, folder.name), problems);
}
async function main() {
  const problems = [];
  await inspectManifest("package.json", problems);
  for (const root of ["apps", "packages"]) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      await inspectWorkspace(path.join(root, entry.name), problems);
    }
  }
  for (const problem of problems) console.error(`${problem.file}: ${problem.code}`);
  if (problems.length) process.exitCode = 1;
  else console.info("Runtime and browser dependency boundaries passed.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
