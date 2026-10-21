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

/** Enforce component boundaries; visual values remain governed by DESIGN.md. */
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
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
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
        if (attrs.has("onClick"))
          report(node, "HeroUI 操作组件使用 onPress；切换组件使用 onChange。");
        if (component === "Button" && attrs.has("aria-pressed"))
          report(node, "切换状态使用 ToggleButton；当前导航使用 aria-current。");
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
                "按钮几何必须使用全局控制尺寸 token 或 DESIGN.md 中具名例外，不能内联 padding/height/radius。",
              );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return violations;
}

async function checkDirectory(directory) {
  let errors = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) errors += await checkDirectory(file);
    else if (file.endsWith(".tsx")) {
      for (const violation of inspectUiSource(await readFile(file, "utf8"), file)) {
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
  else console.log("HeroUI component conventions passed.");
}
