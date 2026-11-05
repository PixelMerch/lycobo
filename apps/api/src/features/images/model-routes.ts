import { imageModelCatalog, imageUnitCredits } from "@lycoboai/contracts";
import type { Hono } from "hono";
import type { Env, ImageApiDependencies } from "./route-context";

export function registerImageModels(app: Hono<Env>, deps: ImageApiDependencies) {
  app.get("/image-models", async (c) => {
    const configured = await deps.repository.models.capabilities();
    const tools = deps.managedModelsOnly
      ? Object.fromEntries(
          Object.entries(configured).map(([tool, models]) => [
            tool,
            models.map((model) =>
              model.managed ? model : { ...model, enabledResolutions: [], editsEnabled: false },
            ),
          ]),
        )
      : configured;
    return c.json({
      enabled: deps.enabled,
      eventsEnabled: !!deps.events,
      editsEnabled:
        (!deps.managedModelsOnly && deps.editsEnabled) ||
        Object.values(tools).some((models) =>
          models.some((m) => m.managed && m.editsEnabled && m.enabledResolutions.length > 0),
        ),
      unitCredits: imageUnitCredits,
      tools,
      models: (
        tools.create ??
        imageModelCatalog.map((m) => ({ ...m, managed: false, enabledResolutions: [] }))
      ).map((model) => {
        if (model.managed) return { id: model.id, enabledResolutions: model.enabledResolutions };
        const enabledResolutions = deps.managedModelsOnly ? [] : deps.resolutions(model.id);
        return { id: model.id, enabledResolutions };
      }),
    });
  });
}
