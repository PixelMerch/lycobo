import { expect, it } from "vitest";
import { configurationDifferences } from "./cloudflare-config.mjs";

const config = {
  vars: { IMAGE_WEBHOOK_ENABLED: "true" },
  secrets: { required: ["IMAGE_WEBHOOK_SECRET"] },
};
const active = [
  { name: "IMAGE_WEBHOOK_ENABLED", type: "plain_text", text: "true" },
  { name: "IMAGE_WEBHOOK_SECRET", type: "secret_text" },
];

it("rejects a stale dashboard draft even when the active version is correct", () => {
  const saved = [{ name: "IMAGE_WEBHOOK_ENABLED", type: "plain_text", text: "false" }];
  expect(configurationDifferences(config, saved, active)).toEqual([
    "settings:IMAGE_WEBHOOK_ENABLED",
    "settings:IMAGE_WEBHOOK_SECRET",
  ]);
});

it("requires the active version to agree with the repository too", () => {
  const disabled = [{ name: "IMAGE_WEBHOOK_ENABLED", type: "plain_text", text: "false" }];
  expect(configurationDifferences(config, disabled, disabled)).toEqual([
    "active:IMAGE_WEBHOOK_ENABLED",
    "active:IMAGE_WEBHOOK_SECRET",
    "settings:IMAGE_WEBHOOK_ENABLED",
    "settings:IMAGE_WEBHOOK_SECRET",
  ]);
});

it("accepts matching settings without reading encrypted secret values", () => {
  expect(configurationDifferences(config, active, active)).toEqual([]);
});
