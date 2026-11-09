import { readdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const serverPackages = /@lycoboai\/(db|queue|generation|storage)(?:[/"']|$)/;
// 只检查运行源代码和依赖声明，防止已移除的平台被当作备用路径重新接入。
const retiredRuntime =
  /@cloudbase\/|tcloudbasegateway\.com|\b(?:CLOUDBASE|TCB|TENCENTCLOUD)_[A-Z_]+/i;
const nodeModules = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));

/** 提取真实导入、重导出和静态动态导入，避免注释与普通字符串误报。 */
export function importSpecifiers(file, text) {
  const specifiers = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** 限制业务反向引用入口及跨应用调用，测试可以使用本应用装配入口。 */
export function layerBoundaryProblems(file, target) {
  const sourceApp = file.match(/^apps\/([^/]+)\//)?.[1];
  const targetApp =
    target.match(/^apps\/([^/]+)\//)?.[1] ??
    target.match(/^@lycoboai\/(api|worker|web|assets)(?:\/|$)/)?.[1];
  const normalized = target.replace(/\.(?:tsx?|m?js)$/, "");
  const problems = [];
  const fixture = /\.(?:test|spec)\.[^/]+$/.test(file);
  const domain = file.match(/^apps\/api\/src\/features\/([^/]+)\//)?.[1];
  if (domain && !fixture) {
    if (/^apps\/api\/src\/(?:app|index|cloudflare|cloudflare-app)$/.test(normalized))
      problems.push("FEATURE_DEPENDS_ON_ENTRYPOINT");
    const targetDomain = normalized.match(/^apps\/api\/src\/features\/([^/]+)\//)?.[1];
    // 路由注册器可以组合路由；服务等业务实现不能依赖另一个业务的 HTTP 层。
    if (
      targetDomain &&
      targetDomain !== domain &&
      /(?:^|\/)(?:[^/]+-)?routes$/.test(normalized) &&
      !/(?:^|\/)(?:[^/]+-)?routes\.ts$/.test(file)
    )
      problems.push("BUSINESS_DEPENDS_ON_FOREIGN_ROUTES");
  }
  const runtimeAssembly =
    file === "apps/api/src/cloudflare-app.ts" &&
    normalized === "apps/worker/src/cloudflare/cloudflare-runtime";
  const integrationAssembly =
    file.startsWith("apps/worker/scripts/") && normalized === "apps/api/src/app";
  if (sourceApp && targetApp && sourceApp !== targetApp && !runtimeAssembly && !integrationAssembly)
    problems.push("UNAUTHORIZED_CROSS_APP_IMPORT");
  return problems;
}

/** 检查依赖方向，同时覆盖包名与相对路径，保留既定入口装配例外。 */
export function importBoundaryProblems(file, specifier) {
  const target = specifier.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    : specifier;
  const appTarget = /^(?:apps\/|@lycoboai\/(?:api|worker|web|assets)(?:\/|$))/.test(target);
  const serverTarget =
    serverPackages.test(`${target}/`) ||
    /^packages\/(?:db|queue|generation|storage)\//.test(target);
  const nodeTarget = target.startsWith("node:") || nodeModules.has(target);
  const problems = layerBoundaryProblems(file, target);
  if (
    /^(?:apps\/web|packages\/contracts)\/src\//.test(file) &&
    (/^(?:apps\/(?:api|worker|assets)\/|@lycoboai\/(?:api|worker|assets)(?:\/|$))/.test(target) ||
      serverTarget ||
      nodeTarget)
  )
    problems.push("SERVER_DEPENDENCY_IN_BROWSER");
  if (file.startsWith("packages/") && appTarget) problems.push("PACKAGE_DEPENDS_ON_APP");
  return problems;
}

/** 返回源文件的运行时边界问题，不输出代码正文或配置值。 */
export function sourceBoundaryProblems(file, text) {
  const problems = [];
  if (retiredRuntime.test(text)) problems.push("RETIRED_RUNTIME_REFERENCE");
  for (const specifier of importSpecifiers(file, text))
    problems.push(...importBoundaryProblems(file, specifier));
  return [...new Set(problems)];
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
    for (const code of importBoundaryProblems(
      file.replace("package.json", "src/manifest.ts"),
      name,
    ))
      problems.push({ file, code });
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
