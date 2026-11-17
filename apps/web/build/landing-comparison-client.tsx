import { createRoot } from "react-dom/client";
import {
  type ComparisonPhotoPair,
  ImageComparison,
} from "../src/features/home/landing/landing-image-comparison";
import "../src/features/home/landing/landing-comparison-utilities.css";

function readComparison(item: HTMLElement): ComparisonPhotoPair | undefined {
  const fragment = item instanceof HTMLTemplateElement ? item.content : item;
  const source = fragment.querySelector<HTMLImageElement>("[data-comparison-source]");
  const result = fragment.querySelector<HTMLImageElement>("[data-comparison-result]");
  const label = item.dataset.comparisonItem;
  if (!label || !source || !result) return undefined;
  return {
    label,
    source: source.src,
    sourceAlt: source.alt,
    result: result.src,
    resultAlt: result.alt,
  };
}

function mountComparison() {
  const host = document.querySelector<HTMLElement>("[data-comparison-host]");
  const sourceLabel = host?.dataset.sourceLabel;
  const resultLabel = host?.dataset.resultLabel;
  const categoryLabel = host?.closest("section")?.getAttribute("aria-label");
  const sliderLabel = host?.dataset.sliderLabel;
  if (!host || !sourceLabel || !resultLabel || !categoryLabel || !sliderLabel) return;
  const items = Array.from(
    host.querySelectorAll<HTMLElement>("[data-comparison-item]"),
    readComparison,
  );
  const [first, ...rest] = items.filter((item) => item !== undefined);
  if (!first) return;
  const cases: [ComparisonPhotoPair, ...ComparisonPhotoPair[]] = [first, ...rest];
  createRoot(host).render(
    <ImageComparison
      cases={cases}
      sourceLabel={sourceLabel}
      resultLabel={resultLabel}
      categoryLabel={categoryLabel}
      sliderLabel={sliderLabel}
    />,
  );
}

mountComparison();
