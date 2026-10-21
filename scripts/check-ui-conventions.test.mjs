import { describe, expect, it } from "vitest";
import { inspectUiSource } from "./check-ui-conventions.mjs";

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
