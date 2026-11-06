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
