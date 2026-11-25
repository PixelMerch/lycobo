import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeControls = new Set(["button", "input", "select", "textarea", "a"]);
const interactiveRoles = new Set([
  "button",
  "dialog",
  "alertdialog",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "tablist",
  "combobox",
  "menu",
  "menuitem",
  "listbox",
  "option",
]);
const geometry = new Set([
  "padding",
  "paddingInline",
  "paddingLeft",
  "paddingRight",
  "height",
  "minHeight",
  "borderRadius",
]);

// 精致感基础修复（用户 2026-11-10）后的样式档位：6px 与 18px 只给嵌套推导（外圆角 = 内圆角 + 内边距）。
const allowedRadii = new Set([
  "0",
  "4px",
  "6px",
  "8px",
  "12px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "999px",
  "50%",
  "inherit",
]);
// 文字用的白色透明度只保留 40／50／60／70／80% 五档。
const allowedTextAlphas = new Set(["66", "80", "99", "b3", "cc"]);

/** 判断是否为偏蓝紫的近灰色（旧版紫灰）：三个通道很接近，但蓝色最高。 */
function isCoolGray(red, green, blue) {
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return (
    spread > 0 && spread <= 16 && Math.max(red, green, blue) < 250 && blue > green && blue >= red
  );
}

/** 一行里不在档位内的圆角。 */
function radiusProblems(text) {
  const match = text.match(/border(?:-(?:top|bottom)-(?:left|right))?-radius:\s*([^;]+);/);
  if (!match || match[1].trim().startsWith("var(")) return [];
  return match[1]
    .trim()
    .split(/\s+/)
    .filter((value) => !allowedRadii.has(value))
    .map((value) => `圆角 ${value} 不在档位内（4/6/8/12/16/18/20/24/28px、999px、50%）。`);
}

/** 一行里偏蓝紫的灰色，十六进制与 rgb() 写法都检查。 */
function grayProblems(text) {
  const colors = [
    ...[...text.matchAll(/(?<![\w-])#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)].map((match) => ({
      label: match[0],
      channels: [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16)),
    })),
    ...[...text.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)].map((match) => ({
      label: match[0],
      channels: match.slice(1, 4).map(Number),
    })),
  ];
  return colors
    .filter(({ channels: [red, green, blue] }) => isCoolGray(red, green, blue))
    .map(({ label }) => `${label} 是偏紫的旧灰色，改用中性灰或主题 token。`);
}

/** 一行里不在档位内的白色文字透明度。 */
function textAlphaProblems(text) {
  const match = text.match(/(?<![-\w])color:\s*#ffffff([0-9a-f]{2})\s*;/i);
  if (!match?.[1] || allowedTextAlphas.has(match[1].toLowerCase())) return [];
  return [`文字颜色 #ffffff${match[1]} 不在透明度档位内（40/50/60/70/80%）。`];
}

/** 检查一份 CSS：离群圆角、偏蓝紫的旧灰色与不在档位里的文字透明度。 */
export function inspectStyleSource(source) {
  return source
    .split("\n")
    .flatMap((text, index) =>
      [...radiusProblems(text), ...grayProblems(text), ...textAlphaProblems(text)].map(
        (message) => ({ line: index + 1, message }),
      ),
    );
}

/** 检查组件边界，视觉数值沿用共享样式与设计变量。 */
function checkButtonProps(node, attrs, component, file, report) {
  if (attrs.has("onClick")) report(node, "HeroUI 操作组件使用 onPress；切换组件使用 onChange。");
  if (component === "Button" && attrs.has("aria-pressed"))
    report(node, "切换状态使用 ToggleButton；当前导航使用 aria-current。");
  checkButtonStyle(attrs, file, report);
}

function checkButtonStyle(attrs, file, report) {
  const style = attrs.get("style")?.initializer;
  if (
    style &&
    ts.isJsxExpression(style) &&
    style.expression &&
    ts.isObjectLiteralExpression(style.expression)
  ) {
    for (const property of style.expression.properties) {
      if (property.name && geometry.has(property.name.getText(file).replace(/["']/g, "")))
        report(
          property,
          "按钮几何必须使用全局控制尺寸 token 或 现有具名例外，不能内联 padding/height/radius。",
        );
    }
  }
}

export function inspectUiSource(source, filename = "component.tsx") {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = new Map();
  const violations = [];
  const report = (node, message) =>
    violations.push({
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      message,
    });
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const module = node.moduleSpecifier.text;
    if (/^(?:@radix-ui\/|@headlessui\/|react-aria-components$)/.test(module))
      report(node, "交互组件只能通过 @heroui/react 使用，禁止引入第二套基础组件。");
    if (module !== "@heroui/react") continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const entry of bindings.elements)
        imports.set(entry.name.text, (entry.propertyName ?? entry.name).text);
    }
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) checkElement(node);
    ts.forEachChild(node, visit);
  }
  function checkElement(node) {
    const tag = node.tagName.getText(file);
    const attrs = new Map(
      node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attr) => [attr.name.getText(file), attr]),
    );
    const literal = (name) => {
      const value = attrs.get(name)?.initializer;
      return value && ts.isStringLiteral(value) ? value.text : undefined;
    };
    // Browser file picking has no HeroUI replacement. Its input must remain hidden;
    // the visible trigger is a HeroUI Button in the same feature.
    const fileInput =
      tag === "input" &&
      literal("type") === "file" &&
      /(?:visually-hidden|sr-only)/.test(literal("className") ?? "");
    if (nativeControls.has(tag) && !fileInput)
      report(node, `原生 <${tag}> 必须改用 HeroUI 对应组件；仅隐藏的文件选择 input 例外。`);
    if (/^[a-z]/.test(tag) && interactiveRoles.has(literal("role")))
      report(node, `禁止以原生元素加 role 手写 ${literal("role")}，请组合 HeroUI 组件。`);
    const component = imports.get(tag);
    if (["Button", "ToggleButton"].includes(component)) {
      checkButtonProps(node, attrs, component, file, report);
    }
  }
  visit(file);
  return violations;
}

async function checkDirectory(directory) {
  let errors = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) errors += await checkDirectory(file);
    else if (file.endsWith(".tsx") || file.endsWith(".css")) {
      const source = await readFile(file, "utf8");
      const violations = file.endsWith(".css")
        ? inspectStyleSource(source)
        : inspectUiSource(source, file);
      for (const violation of violations) {
        console.error(`${file}:${violation.line}: ${violation.message}`);
        errors++;
      }
    }
  }
  return errors;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkDirectory("apps/web/src");
  if (errors) process.exitCode = 1;
  else console.log("HeroUI component and style conventions passed.");
}
