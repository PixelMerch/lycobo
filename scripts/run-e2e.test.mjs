import { expect, it } from "vitest";
import { browserTestArguments } from "./run-e2e.mjs";

it("refuses accidental full runs including shard-only and inverted filters", () => {
  for (const args of [
    [],
    ["--shard=1/2"],
    ["--grep", ""],
    ["--grep-invert", "login"],
    ["tests/e2e"],
    ["tests/e2e/missing.spec.ts"],
  ])
    expect(() => browserTestArguments(args)).toThrow("请指定");
});
it("preserves focused files and positive test filters", () => {
  for (const args of [
    ["tests/e2e/prompt-field.spec.ts"],
    ["--grep", "登录", "--max-failures=1"],
    ["--grep=登录"],
    ["-g", "login"],
  ])
    expect(browserTestArguments(args)).toEqual(args);
});
it("allows explicit full runs and read-only test discovery without forwarding the custom flag", () => {
  expect(browserTestArguments(["--full", "--shard=1/2"])).toEqual(["--shard=1/2"]);
  expect(browserTestArguments(["--", "--grep=login"])).toEqual(["--grep=login"]);
  expect(browserTestArguments(["--list"])).toEqual(["--list"]);
});
