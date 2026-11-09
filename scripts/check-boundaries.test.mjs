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

it("rejects business imports of application entrypoints and foreign HTTP routes", () => {
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/service.ts",
      'export { createApp } from "../../app.js";',
    ),
  ).toContain("FEATURE_DEPENDS_ON_ENTRYPOINT");
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/service.ts",
      'const routes = import("../wallet/wallet-routes");',
    ),
  ).toContain("BUSINESS_DEPENDS_ON_FOREIGN_ROUTES");
});
it("limits cross-app assembly to the documented dependency edges", () => {
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/service.ts",
      'import runtime from "../../../../worker/src/cloudflare/cloudflare-runtime";',
    ),
  ).toContain("UNAUTHORIZED_CROSS_APP_IMPORT");
  expect(
    sourceBoundaryProblems(
      "apps/api/src/cloudflare-app.ts",
      'import consumer from "../../worker/src/cloudflare/cloudflare-consumer";',
    ),
  ).toContain("UNAUTHORIZED_CROSS_APP_IMPORT");
  expect(
    sourceBoundaryProblems("apps/worker/src/images/example.ts", 'import app from "@lycoboai/api";'),
  ).toContain("UNAUTHORIZED_CROSS_APP_IMPORT");
  expect(
    sourceBoundaryProblems("apps/worker/scripts/check.ts", 'import app from "../../api/src/app";'),
  ).toEqual([]);
});
it("preserves route registration, service sharing and local app integration tests", () => {
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/routes.ts",
      'import routes from "../wallet/wallet-routes";',
    ),
  ).toEqual([]);
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/service.ts",
      'import service from "../wallet/service";',
    ),
  ).toEqual([]);
  expect(
    sourceBoundaryProblems(
      "apps/api/src/features/images/routes.test.ts",
      'import app from "../../app";',
    ),
  ).toEqual([]);
});
