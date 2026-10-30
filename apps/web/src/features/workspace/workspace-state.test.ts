import { beforeEach, describe, expect, it } from "vitest";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { useStudioStore } from "../generation/studio-state";
import { shareProductReference } from "./workspace-state";

const reference = (id: string) => ({ id, name: id, src: `/fixtures/${id}.webp` });
beforeEach(() => {
  useStudioStore.setState(useStudioStore.getInitialState());
  useTextileSetDraft.setState(useTextileSetDraft.getInitialState());
  useSmartVariationDraft.setState(useSmartVariationDraft.getInitialState());
});

describe("workspace draft handoff", () => {
  it("seeds an empty tool with the product while retaining both descriptions", () => {
    const studio = useStudioStore.getState();
    studio.updateDraft(studio.activeModel, { prompt: "source", references: [reference("main")] });
    useSmartVariationDraft.getState().update({ description: "destination" });
    shareProductReference("/create", "/commerce/smart-variation");
    expect(useSmartVariationDraft.getState().image?.id).toBe("main");
    expect(useSmartVariationDraft.getState().description).toBe("destination");
    expect(useStudioStore.getState().drafts[studio.activeModel]?.prompt).toBe("source");
  });
  it("never replaces an existing destination image", () => {
    useTextileSetDraft.getState().update({ mainImage: reference("source") });
    useSmartVariationDraft.getState().update({ image: reference("keep") });
    shareProductReference("/commerce/textile-set", "/commerce/smart-variation");
    expect(useSmartVariationDraft.getState().image?.id).toBe("keep");
  });
  it("limits creation references to five without modifying the textile draft", () => {
    const details = Array.from({ length: 5 }, (_, i) => reference(`detail-${i}`));
    useTextileSetDraft.getState().update({ mainImage: reference("main"), detailImages: details });
    shareProductReference("/commerce/textile-set", "/create");
    const studio = useStudioStore.getState();
    expect(studio.drafts[studio.activeModel]?.references.map((image) => image.id)).toEqual([
      "main",
      "detail-0",
      "detail-1",
      "detail-2",
      "detail-3",
    ]);
    expect(useTextileSetDraft.getState().detailImages).toHaveLength(5);
  });
  it("preserves existing textile details when adding a main image", () => {
    const studio = useStudioStore.getState();
    studio.updateDraft(studio.activeModel, {
      references: [reference("main"), reference("new-detail")],
    });
    useTextileSetDraft.getState().update({ detailImages: [reference("keep-detail")] });
    shareProductReference("/create", "/commerce/textile-set");
    expect(useTextileSetDraft.getState().mainImage?.id).toBe("main");
    expect(useTextileSetDraft.getState().detailImages[0]?.id).toBe("keep-detail");
  });
});
