import { imageModelsResponseSchema } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { modelCapabilities, supportsReferences } from "./model-capabilities";

const response = imageModelsResponseSchema.parse({
  enabled: true,
  editsEnabled: true,
  unitCredits: 20,
  models: [{ id: "grok", enabledResolutions: ["1K"] }],
  tools: {
    create: [
      {
        id: "grok",
        enabledResolutions: ["1K"],
        editsEnabled: false,
        managed: true,
        maxReferences: 0,
      },
    ],
    "local-edit": [
      {
        id: "gpt-image-2.5",
        enabledResolutions: ["2K"],
        editsEnabled: true,
        managed: true,
        maxReferences: 1,
      },
    ],
  },
});

describe("model capabilities", () => {
  it("does not let another model's edit support enable references", () => {
    const capabilities = modelCapabilities(response, "grok", "create");
    expect(capabilities?.enabledResolutions).toEqual(["1K"]);
    expect(supportsReferences(capabilities, 0)).toBe(true);
    expect(supportsReferences(capabilities, 1)).toBe(false);
  });
  it("keeps tools separate and enforces the selected channel reference limit", () => {
    expect(modelCapabilities(response, "grok", "local-edit")).toBeUndefined();
    expect(modelCapabilities(response, "grok", "textile-set")).toBeUndefined();
    const capabilities = modelCapabilities(response, "gpt-image-2.5-sunburst", "local-edit");
    expect(supportsReferences(capabilities, 1)).toBe(true);
    expect(supportsReferences(capabilities, 2)).toBe(false);
  });
  it("supports responses from older deployments without tools", () => {
    const { tools: _tools, ...legacy } = response;
    expect(supportsReferences(modelCapabilities(legacy, "grok", "create"), 5)).toBe(true);
    expect(supportsReferences(modelCapabilities(legacy, "grok", "create"), 6)).toBe(false);
    expect(
      supportsReferences(
        modelCapabilities({ ...legacy, editsEnabled: false }, "grok", "create"),
        1,
      ),
    ).toBe(false);
  });
  it("disables unavailable models and a disabled service", () => {
    expect(modelCapabilities(undefined, "grok", "create")).toBeUndefined();
    expect(modelCapabilities({ ...response, enabled: false }, "grok", "create")).toBeUndefined();
    expect(modelCapabilities(response, "unknown", "create")).toBeUndefined();
    expect(supportsReferences(undefined, 1)).toBe(false);
  });
});
