import cardTemplate from "./landing-review-card.html?raw";
import reviewsTemplate from "./landing-reviews.html?raw";

/** 组合两行评价模板；保留文案占位符，由首页渲染器统一转义本地化内容。 */
export function renderLandingReviews() {
  const row = (indices: number[]) =>
    indices.map((index) => cardTemplate.replaceAll("__INDEX__", String(index))).join("\n");
  return reviewsTemplate
    .replace("__LYCOBO_REVIEW_ROW_ONE__", () => row([1, 2, 3, 4]))
    .replace("__LYCOBO_REVIEW_ROW_TWO__", () => row([5, 6, 7, 8]));
}
