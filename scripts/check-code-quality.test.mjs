import { describe, expect, it } from "vitest";
import {
  compareToBaseline,
  countTypeAssertions,
  excessLines,
  findOrphans,
  tightenBaseline,
} from "./check-code-quality.mjs";

const lines = (count) => "x\n".repeat(count);

describe("excessLines", () => {
  it("reports a file only when it is over budget", () => {
    expect(excessLines("apps/web/src/a.ts", lines(400))).toBe(0);
    expect(excessLines("apps/web/src/a.ts", lines(401))).toBe(401);
    expect(excessLines("apps/web/src/a.css", lines(500))).toBe(0);
    expect(excessLines("apps/web/src/a.css", lines(501))).toBe(501);
  });

  it("does not limit tests or the database schema", () => {
    expect(excessLines("apps/web/src/a.test.ts", lines(900))).toBe(0);
    expect(excessLines("tests/e2e/a.spec.ts", lines(900))).toBe(0);
    expect(excessLines("packages/db/src/schema.ts", lines(900))).toBe(0);
  });
});

describe("countTypeAssertions", () => {
  it("counts assertions but not const assertions", () => {
    const source = 'const a = value as string;\nconst b = ["x"] as const;\n';
    expect(countTypeAssertions("apps/api/src/a.ts", source)).toBe(1);
  });

  it("ignores tests and stylesheets", () => {
    expect(countTypeAssertions("apps/api/src/a.test.ts", "const a = b as string;")).toBe(0);
    expect(countTypeAssertions("apps/web/src/a.css", ".a { color: red; }")).toBe(0);
  });
});

describe("findOrphans", () => {
  it("resolves a public package subpath to its nested implementation", () => {
    const sources = new Map([
      ["apps/api/src/cloudflare.ts", 'import "@lycoboai/storage/cloudflare";'],
      ["packages/storage/src/index.ts", ""],
      ["packages/storage/src/cloudflare/cloudflare.ts", ""],
    ]);
    expect(findOrphans(sources)).toEqual([]);
  });

  it("finds modules nothing imports, following relative, package and dynamic imports", () => {
    const sources = new Map([
      ["apps/web/src/main.tsx", 'import "./used";\nimport("./lazy");'],
      ["apps/web/src/used.ts", 'import "@lycoboai/contracts/shared";'],
      ["apps/web/src/lazy.tsx", ""],
      ["apps/web/src/dead.tsx", ""],
      ["packages/contracts/src/index.ts", ""],
      ["packages/contracts/src/shared.ts", ""],
    ]);
    expect(findOrphans(sources)).toEqual(["apps/web/src/dead.tsx"]);
  });
});

describe("compareToBaseline", () => {
  it("fails on growth and on new violations", () => {
    const current = { a: { lines: 501 }, b: { noNestedTernary: 1 } };
    const { grown } = compareToBaseline(current, { a: { lines: 500 } }, ["a", "b"]);
    expect(grown).toEqual([
      { file: "a", metric: "lines", now: 501, allowed: 500 },
      { file: "b", metric: "noNestedTernary", now: 1, allowed: 0 },
    ]);
  });

  it("reports improvements, including violations that are gone", () => {
    const baseline = { a: { lines: 500 }, gone: { noNestedTernary: 2 } };
    const { grown, improved } = compareToBaseline({ a: { lines: 450 } }, baseline, ["a", "gone"]);
    expect(grown).toEqual([]);
    expect(improved).toEqual([
      { file: "a", metric: "lines", now: 450, allowed: 500 },
      { file: "gone", metric: "noNestedTernary", now: 0, allowed: 2 },
    ]);
  });

  it("only looks at the requested files", () => {
    const current = { a: { lines: 900 } };
    expect(compareToBaseline(current, {}, ["b"]).grown).toEqual([]);
  });
});

describe("tightenBaseline", () => {
  it("lowers numbers and drops fixed entries", () => {
    const baseline = { a: { lines: 500, noNestedTernary: 2 }, gone: { lines: 600 } };
    const current = { a: { lines: 450, noNestedTernary: 2 } };
    expect(tightenBaseline(current, baseline)).toEqual({ a: { lines: 450, noNestedTernary: 2 } });
  });

  it("never raises a number or adds a violation", () => {
    const current = { a: { lines: 900 }, b: { lines: 900 } };
    expect(tightenBaseline(current, { a: { lines: 500 } })).toEqual({ a: { lines: 500 } });
  });
});
