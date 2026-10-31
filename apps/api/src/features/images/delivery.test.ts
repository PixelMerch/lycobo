import type { ImageRepository } from "@lycoboai/db";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { expect, it, vi } from "vitest";
import { imageDeliveries } from "./delivery";

it("batch signs only authorized asset locations for outputs and references", async () => {
  const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
  const output = crypto.randomUUID(),
    reference = crypto.randomUUID(),
    inaccessible = crypto.randomUUID();
  const assetLocations = vi.fn<ImageRepository["assetLocations"]>().mockResolvedValue(
    [output, reference].map((id) => ({
      id,
      objectKey: `0057849613/${scope.organizationId}/${id}.png`,
    })),
  );
  const deliveries = imageDeliveries(
    { assetLocations },
    assetDeliverySigner("https://assets.example.test", "fixture-signing-key-with-32-characters"),
  );
  const jobs = await deliveries.jobs(scope, [
    {
      id: crypto.randomUUID(),
      organization_id: scope.organizationId,
      user_id: scope.userId,
      model: "gpt-image-2",
      prompt: "fixture",
      resolution: "1K",
      aspect_ratio: "1:1",
      requested_count: 2,
      status: "running",
      created_at: new Date().toISOString(),
      completed_at: null,
      input: {
        model: "gpt-image-2",
        prompt: "fixture",
        referenceAssetIds: [reference, inaccessible],
      },
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status: "succeeded",
          output_asset_id: output,
          error_code: null,
          width: 1024,
          height: 1024,
          worker_id: null,
        },
      ],
    },
  ]);
  expect(assetLocations).toHaveBeenCalledTimes(1);
  expect(assetLocations).toHaveBeenCalledWith(
    scope,
    expect.arrayContaining([output, reference, inaccessible]),
  );
  expect(jobs[0]?.items[0]?.output_delivery?.url).toContain(output);
  expect(jobs[0]?.reference_deliveries[reference]?.url).toContain(reference);
  expect(jobs[0]?.reference_deliveries[inaccessible]).toBeUndefined();
});
