import { expect, it } from "vitest";
import { sourceBoundaryProblems } from "./check-boundaries.mjs";

it("rejects retired SDK, gateway and credential adapters in server source", () => {
  for (const text of [
    'import sdk from "@cloudbase/node-sdk";',
    'const host="https://fixture.api.tcloudbasegateway.com";',
    "env.CLOUDBASE_APIKEY",
  ])
    expect(sourceBoundaryProblems("apps/api/src/adapter.ts", text)).toContain(
      "RETIRED_RUNTIME_REFERENCE",
    );
});
it("rejects server packages and Node imports in browser source", () => {
  for (const text of [
    'import { openDatabase } from "@lycoboai/db";',
    'import { readFile } from "node:fs/promises";',
  ])
    expect(sourceBoundaryProblems("apps/web/src/client.ts", text)).toContain(
      "SERVER_DEPENDENCY_IN_BROWSER",
    );
});
it("permits browser contracts and current Workers bindings", () => {
  expect(
    sourceBoundaryProblems(
      "apps/web/src/client.ts",
      'import { realtimeFrameSchema } from "@lycoboai/contracts";',
    ),
  ).toEqual([]);
  expect(
    sourceBoundaryProblems("apps/api/src/cloudflare.ts", "env.REALTIME; env.HYPERDRIVE;"),
  ).toEqual([]);
});
it("rejects contract re-exports, bare Node modules and package-to-app dependencies", () => {
  expect(
    sourceBoundaryProblems(
      "packages/contracts/src/example.ts",
      'export * from "../../db/src/index";',
    ),
  ).toContain("SERVER_DEPENDENCY_IN_BROWSER");
  expect(
    sourceBoundaryProblems(
      "packages/contracts/src/example.ts",
      'const fs = require("fs/promises");',
    ),
  ).toContain("SERVER_DEPENDENCY_IN_BROWSER");
  expect(
    sourceBoundaryProblems(
      "packages/db/src/example.ts",
      'const app = import("../../../apps/api/src/app");',
    ),
  ).toContain("PACKAGE_DEPENDS_ON_APP");
  expect(
    sourceBoundaryProblems("packages/db/src/example.ts", 'export * from "@lycoboai/api";'),
  ).toContain("PACKAGE_DEPENDS_ON_APP");
});
it("allows local browser modules, Node server imports and existing runtime assembly", () => {
  expect(
    sourceBoundaryProblems(
      "apps/web/src/features/example.ts",
      'import { value } from "../other"; // import "node:fs"',
    ),
  ).toEqual([]);
  expect(sourceBoundaryProblems("apps/api/src/index.ts", 'import fs from "node:fs";')).toEqual([]);
  expect(
    sourceBoundaryProblems(
      "apps/api/src/cloudflare-app.ts",
      'import { openCloudflareRuntime } from "../../worker/src/cloudflare/cloudflare-runtime";',
    ),
  ).toEqual([]);
});
