import { describe, expect, it } from "vitest";
import {
  defaultAssetFilters,
  filtersFromSearch,
  filtersToSearch,
  libraryQuery,
  timeRangeStart,
  toolAssetFilters,
} from "./asset-library-client";

describe("asset library filters", () => {
  it("keeps the default view's address clean and round-trips every changed filter", () => {
    expect(filtersToSearch(defaultAssetFilters).toString()).toBe("");
    const changed = {
      source: "generated",
      tool: "textile",
      favorite: true,
      time: "30",
    } as const;
    const search = filtersToSearch(changed);
    expect(search.toString()).toBe("source=generated&tool=textile&time=30&favorite=1");
    expect(filtersFromSearch(search)).toEqual(changed);
  });

  it("reads older links: favorites become 仅看收藏, tools imply AI 生成, retired filters drop", () => {
    expect(filtersFromSearch(new URLSearchParams("source=favorites&model=gpt-image-2"))).toEqual({
      ...defaultAssetFilters,
      favorite: true,
    });
    expect(filtersFromSearch(new URLSearchParams("tool=create&type=all"))).toEqual({
      ...defaultAssetFilters,
      source: "generated",
      tool: "create",
    });
    expect(filtersFromSearch(new URLSearchParams("source=other&time=365"))).toEqual(
      defaultAssetFilters,
    );
    expect(filtersFromSearch(new URLSearchParams("tool=video&type=video&favorite=1"))).toEqual({
      ...defaultAssetFilters,
      favorite: true,
    });
  });

  it("asks the API for images and applies the remaining filters before paging", () => {
    const all = libraryQuery(defaultAssetFilters);
    expect(all.get("type")).toBe("image");
    expect(all.has("includeVideo")).toBe(false);
    expect(all.has("kind")).toBe(false);
    expect(all.has("since")).toBe(false);
    expect(libraryQuery({ ...defaultAssetFilters, source: "uploads" }).get("kind")).toBe(
      "reference",
    );
    // 功能只属于 AI 生成；来源换成全部时不再按功能筛选。
    expect(libraryQuery({ ...defaultAssetFilters, tool: "textile" }).has("tool")).toBe(false);
    const generated = libraryQuery({
      ...defaultAssetFilters,
      source: "generated",
      tool: "textile",
      favorite: true,
      time: "7",
    });
    expect(generated.get("kind")).toBe("output");
    expect(generated.get("tool")).toBe("textile");
    expect(generated.get("favorite")).toBe("true");
    expect(generated.get("since")).toBeTruthy();
  });

  it("starts a time range at local midnight and counts today in the range", () => {
    const now = new Date(2026, 10, 10, 15, 30);
    expect(timeRangeStart("today", now)).toEqual(new Date(2026, 10, 10));
    expect(timeRangeStart("7", now)).toEqual(new Date(2026, 10, 4));
    expect(timeRangeStart("30", now)).toEqual(new Date(2026, 9, 12));
  });

  it("opens the library on the current image tool or defaults to all images", () => {
    expect(toolAssetFilters(undefined)).toEqual(defaultAssetFilters);
    expect(toolAssetFilters("textile")).toEqual({
      ...defaultAssetFilters,
      source: "generated",
      tool: "textile",
    });
    expect(toolAssetFilters("video")).toEqual(defaultAssetFilters);
  });
});
