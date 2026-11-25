import { publicImageUrl } from "../../../lib/public-image-url";
/** 功能区和工作台共用同一组皮包套图和图注。 */
export const landingImageSetExamples = [
  {
    id: "bag-studio",
    image: publicImageUrl("/landing/examples/bag-set-studio.webp"),
    titleKey: "bagStudioTitle",
  },
  {
    id: "bag-on-model",
    image: publicImageUrl("/landing/examples/bag-set-on-model.webp"),
    titleKey: "bagModelTitle",
  },
  {
    id: "bag-clasp",
    image: publicImageUrl("/landing/examples/bag-set-clasp.webp"),
    titleKey: "bagClaspTitle",
  },
] as const;
