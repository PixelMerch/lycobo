import type { ReferenceImage } from "./design-data";

/** Keep each valid reference once; retain all ordinary description text. */
export function parseReferencePrompt(prompt: string, references: ReferenceImage[]) {
  const selected: ReferenceImage[] = [];
  const description = prompt.replace(/@图片(\d+)[ \t]?/g, (token, number: string) => {
    const image = references.find((reference) => reference.number === Number(number));
    if (!image) return token;
    if (!selected.some((reference) => reference.id === image.id)) selected.push(image);
    return "";
  });
  return { selected, description };
}

export function formatReferencePrompt(selected: ReferenceImage[], description: string) {
  const tokens = selected.map((image) => `@图片${image.number}`).join(" ");
  return tokens ? `${tokens} ${description}` : description;
}

export function insertReferenceSpace(description: string, start: number, end: number) {
  const from = Math.max(0, Math.min(start, description.length));
  const to = Math.max(from, Math.min(end, description.length));
  return {
    description: `${description.slice(0, from)} ${description.slice(to)}`,
    caret: from + 1,
  };
}
