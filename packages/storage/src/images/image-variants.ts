export const displayVariants = {
  thumbnail: { width: 512, height: 512, quality: 76 },
  preview: { width: 1600, height: 1600, quality: 82 },
} as const;
export type DisplayVariant = keyof typeof displayVariants;
export const displayObjectKey = (key: string, variant: DisplayVariant) =>
  key.replace(/\.png$/, `.${variant}.webp`);

// Bump the version if the provider reference encoding changes.
export const providerReferenceObjectKey = (key: string, extension: "jpg" | "png") =>
  `${key}.provider-v1.${extension}`;
