import { describe, expect, it } from "vitest";
import { inspectStyleSource, inspectUiSource } from "./check-ui-conventions.mjs";

describe("HeroUI component conventions", () => {
  it("rejects handwritten controls, roles and alternate primitives", () => {
    expect(inspectUiSource("<button>提交</button>")).toHaveLength(1);
    expect(inspectUiSource('<div role="dialog" />')).toHaveLength(1);
    expect(inspectUiSource('import { Dialog } from "@radix-ui/react-dialog";')).toHaveLength(1);
  });
  it("checks aliased HeroUI buttons and rejects inline geometry and fake toggle state", () => {
    const source =
      'import { Button as Action } from "@heroui/react"; const ui = <Action onClick={save} aria-pressed={true} style={{padding: 24, height: 60}} />;';
    expect(inspectUiSource(source)).toHaveLength(4);
  });
  it("allows official composition and the hidden native file input exception", () => {
    const source =
      'import { Button, ToggleButton, InputGroup } from "@heroui/react"; const ui = <><Button size="sm" onPress={save}>保存</Button><ToggleButton isSelected={selected} onChange={change} /><InputGroup><InputGroup.Input /></InputGroup><input type="file" className="visually-hidden" /></>;';
    expect(inspectUiSource(source)).toEqual([]);
    expect(inspectUiSource('<input type="file" />')).toHaveLength(1);
    expect(inspectUiSource('<input type="text" className="visually-hidden" />')).toHaveLength(1);
  });
});

describe("style conventions", () => {
  it("rejects off-scale radii, old purple grays and off-scale text alpha", () => {
    const source = [
      ".a { border-radius: 10px; }",
      ".b { border-radius: 0 14px 0 8px; }",
      ".c { background: #17171b; }",
      ".d { background: rgb(15 15 18 / 62%); }",
      ".e { color: #ffffffd9; }",
    ].join("\n");
    expect(inspectStyleSource(source).map((violation) => violation.line)).toEqual([1, 2, 3, 4, 5]);
  });
  it("allows the scale, tokens, neutral grays, brand green tints and allowed text alpha", () => {
    const source = [
      ".a { border-radius: 12px; }",
      ".b { border-radius: 0 6px 0 8px; }",
      ".c { border-radius: var(--control-radius); }",
      ".d { background: #171717; color: #ffffffb3; }",
      ".e { background: #0d100c; box-shadow: 0 0 0 1px #ffffff1f; }",
    ].join("\n");
    expect(inspectStyleSource(source)).toEqual([]);
  });
});
