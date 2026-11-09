import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { imageRequest } from "../../generation/image-request";
import { submitImage, uploadImageReferences } from "../../generation/image-submission";
import { completeReferenceUpload } from "../../generation/references/complete-reference-upload";
import { preparePendingPlan } from "./prepare-pending-plan";

vi.mock("../../generation/image-request", () => ({
  imageRequest: vi.fn(),
  ImageApiError: class extends Error {},
}));
vi.mock("../../generation/references/prepare-reference-upload", () => ({
  prepareReferenceUpload: async (blob: Blob) => blob,
}));
vi.mock("../../generation/references/complete-reference-upload", () => ({
  completeReferenceUpload: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("returns the plan input while upload is pending, but blocks paid submission until the asset is persisted", async () => {
  const memory = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob(["fixture"], { type: "image/png" }))),
  );
  let resolveUpload: ((asset: { id: string }) => void) | undefined;
  const upload = new Promise<{ id: string }>((resolve) => {
    resolveUpload = resolve;
  });
  vi.mocked(completeReferenceUpload).mockReturnValue(upload);
  vi.mocked(imageRequest).mockImplementation(
    async (path) =>
      new Response(
        JSON.stringify(path === "image-tasks" ? { id: crypto.randomUUID(), replayed: false } : {}),
      ),
  );
  const client = new QueryClient();
  const scope = { organizationId: crypto.randomUUID(), userId: crypto.randomUUID() };
  const references = [{ id: "local", src: "blob:fixture", name: "fixture" }];
  const draft = { description: "生成一张商品图", references };
  const pending = preparePendingPlan("plan", draft, () =>
    uploadImageReferences(client, scope, references),
  );
  expect(pending.input).toMatchObject({ referenceCount: 1, referenceAssetIds: [] });
  const submission = submitImage(client, scope, {
    model: "gpt-image-2.5",
    draft: {
      references,
      prompt: draft.description,
      ratio: "1:1",
      resolution: "1.5K",
      quality: "标准",
      count: "1",
    },
  });
  await vi.waitFor(() => expect(completeReferenceUpload).toHaveBeenCalledOnce());
  expect(vi.mocked(imageRequest).mock.calls.some(([path]) => path === "image-tasks")).toBe(false);
  const assetId = crypto.randomUUID();
  resolveUpload?.({ id: assetId });
  await submission;
  const paid = vi.mocked(imageRequest).mock.calls.find(([path]) => path === "image-tasks");
  expect(JSON.parse(String(paid?.[1]?.body)).referenceAssetIds).toEqual([assetId]);
  client.clear();
});

it("keeps the persisted planning key after upload failure so upload retries do not repeat planning", async () => {
  const memory = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
  const upload = vi.fn(async () => {
    throw new Error("fixture upload failed");
  });
  const draft = { description: "生成一张商品图", references: [{ id: "local" }] };
  const first = preparePendingPlan("plan", draft, upload);
  await Promise.resolve();
  const second = preparePendingPlan("plan", draft, upload);
  expect(second).toEqual(first);
  await Promise.resolve();
});
