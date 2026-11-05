import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Ratchet for code quality: new code must meet the limits, and existing violations recorded in
 * the baseline may only shrink. See docs/code-quality.md for what each metric means.
 */
const baselinePath = "scripts/code-quality-baseline.json";
const biomeRules = [
  "complexity/noExcessiveCognitiveComplexity",
  "complexity/noExcessiveLinesPerFunction",
  "complexity/noImportantStyles",
  "style/noDescendingSpecificity",
  "style/noNestedTernary",
  "suspicious/noEmptyBlockStatements",
];
const lineLimits = { code: 400, css: 500 };
const sourceFile = /^(?:apps|packages|scripts|tests)\/.*\.(?:ts|tsx|mjs|css)$/;
const testFile = /\.(?:test|spec)\.|^tests\//;
/** Table definitions grow with the data model, so the size limit does not apply. */
const sizeExempt = new Set(["packages/db/src/schema.ts"]);
const entryPoints = new Set([
  "apps/api/src/assets-server.ts",
  "apps/api/src/index.ts",
  "apps/assets/src/index.ts",
  "apps/web/src/main.tsx",
  "apps/worker/src/cloudbase-consumer.ts",
  "apps/worker/src/local-consumer.ts",
]);

/** The file's length when it is over budget, otherwise 0. Tests may be as long as they need. */
export function excessLines(file, text) {
  if (testFile.test(file) || sizeExempt.has(file)) return 0;
  const lines = text.split("\n").length - 1;
  return lines > (file.endsWith(".css") ? lineLimits.css : lineLimits.code) ? lines : 0;
}

function parse(file, text) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

/** Counts `value as Type`. `as const` only narrows a literal, so it does not count. */
export function countTypeAssertions(file, text) {
  if (testFile.test(file) || file.endsWith(".css")) return 0;
  const source = parse(file, text);
  let count = 0;
  const visit = (node) => {
    if (ts.isAsExpression(node) && node.type.getText(source) !== "const") count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

function importedSpecifiers(file, text) {
  const specifiers = [];
  const visit = (node) => {
    const isStatic = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
    if (isStatic && node.moduleSpecifier) specifiers.push(node.moduleSpecifier.text);
    const isDynamic =
      ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    if (isDynamic && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return specifiers;
}

function resolveImport(from, specifier, known) {
  let base;
  if (specifier.startsWith(".")) {
    base = path.posix.join(path.posix.dirname(from), specifier).replace(/\.js$/, "");
  } else if (specifier.startsWith("@lycoboai/")) {
    const [, name, ...rest] = specifier.split("/");
    base = `packages/${name}/src/${rest.join("/") || "index"}`;
  } else {
    return null;
  }
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((file) => known.has(file));
}

/** Source modules that nothing imports. `sources` maps each file to its text. */
export function findOrphans(sources) {
  const known = new Set(sources.keys());
  const imported = new Set();
  for (const [file, text] of sources) {
    if (file.endsWith(".css")) continue;
    for (const specifier of importedSpecifiers(file, text)) {
      imported.add(resolveImport(file, specifier, known));
    }
  }
  const isModule = (file) =>
    /^(?:apps|packages)\/[^/]+\/src\/.*\.tsx?$/.test(file) && !file.endsWith(".d.ts");
  return [...known].filter(
    (file) =>
      isModule(file) &&
      !testFile.test(file) &&
      !entryPoints.has(file) &&
      !/^packages\/[^/]+\/src\/index\.ts$/.test(file) &&
      !imported.has(file),
  );
}

function biomeCounts(files) {
  const { stdout } = spawnSync(
    path.join("node_modules", ".bin", "biome"),
    [
      "lint",
      ...files,
      ...biomeRules.map((rule) => `--only=${rule}`),
      "--diagnostic-level=info",
      "--reporter=json",
      "--max-diagnostics=none",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const counts = {};
  for (const diagnostic of JSON.parse(stdout.slice(stdout.indexOf("{"))).diagnostics) {
    const file = diagnostic.location.path.file ?? diagnostic.location.path;
    // `--only` overrides the per-file "off" settings in biome.json, so skip tests here.
    if (testFile.test(file)) continue;
    const rule = diagnostic.category.split("/").at(-1);
    counts[file] ??= {};
    counts[file][rule] = (counts[file][rule] ?? 0) + 1;
  }
  return counts;
}

/** Current metrics per file. Metrics that are 0 stay out of the result. */
export function collectMetrics(sources, files = [...sources.keys()]) {
  const metrics = biomeCounts(files);
  for (const file of files) {
    const text = sources.get(file);
    const lines = excessLines(file, text);
    const typeAssertions = countTypeAssertions(file, text);
    if (lines || typeAssertions) metrics[file] ??= {};
    if (lines) metrics[file].lines = lines;
    if (typeAssertions) metrics[file].typeAssertions = typeAssertions;
  }
  return metrics;
}

/** Splits differences into regressions, which fail, and improvements the baseline must record. */
export function compareToBaseline(current, baseline, files) {
  const grown = [];
  const improved = [];
  for (const file of files) {
    const metrics = new Set([
      ...Object.keys(current[file] ?? {}),
      ...Object.keys(baseline[file] ?? {}),
    ]);
    for (const metric of metrics) {
      const now = current[file]?.[metric] ?? 0;
      const allowed = baseline[file]?.[metric] ?? 0;
      if (now > allowed) grown.push({ file, metric, now, allowed });
      else if (now < allowed) improved.push({ file, metric, now, allowed });
    }
  }
  return { grown, improved };
}

/** The baseline with every number lowered to the current value. It can never rise. */
export function tightenBaseline(current, baseline) {
  const tightened = {};
  for (const file of Object.keys(baseline).sort()) {
    for (const [metric, allowed] of Object.entries(baseline[file])) {
      const now = Math.min(current[file]?.[metric] ?? 0, allowed);
      if (now === 0) continue;
      tightened[file] ??= {};
      tightened[file][metric] = now;
    }
  }
  return tightened;
}

function readSources() {
  const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const sources = new Map();
  for (const file of listed.split("\n")) {
    if (!sourceFile.test(file)) continue;
    try {
      sources.set(file, readFileSync(file, "utf8"));
    } catch {
      // Listed but deleted in the working tree: nothing to measure.
    }
  }
  return sources;
}

function report({ grown, improved }, orphans, isFullScan) {
  for (const { file, metric, now, allowed } of grown) {
    console.error(`${file}: ${metric} ${allowed} → ${now}。不能新增违规，请修改代码。`);
  }
  for (const file of orphans) console.error(`${file}: 没有任何文件引用，请删除或接入。`);
  if (isFullScan && improved.length) {
    console.error(`${improved.length} 项已改善，运行 pnpm quality:update 收紧基线后再提交。`);
  }
  const failed = grown.length > 0 || orphans.length > 0 || (isFullScan && improved.length > 0);
  if (!failed) console.log("Code quality checks passed.");
  return failed;
}

function main(args) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const sources = readSources();
  const staged = args
    .filter((arg) => !arg.startsWith("--"))
    .map((file) => path.relative(process.cwd(), file))
    .filter((file) => sources.has(file));
  const isFullScan = !args.some((arg) => !arg.startsWith("--"));
  if (!isFullScan && staged.length === 0) return;
  const files = isFullScan ? [...sources.keys()] : staged;
  const current = collectMetrics(sources, files);
  if (args.includes("--update")) {
    const tightened = tightenBaseline(current, baseline);
    writeFileSync(baselinePath, `${JSON.stringify(tightened, null, 2)}\n`);
    console.log(`Baseline tightened: ${baselinePath}`);
    return;
  }
  const scope = isFullScan ? new Set([...files, ...Object.keys(baseline)]) : files;
  const orphans = isFullScan ? findOrphans(sources) : [];
  if (report(compareToBaseline(current, baseline, scope), orphans, isFullScan)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
