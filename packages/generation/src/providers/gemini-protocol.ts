import { z } from "zod";

const imageMime = z.enum(["image/png", "image/jpeg", "image/webp"]);
const part = z.object({
  thought: z.boolean().optional(),
  inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
  fileData: z.object({ mimeType: z.string(), fileUri: z.string() }).optional(),
});
const nativeReply = z
  .object({
    candidates: z.array(
      z.object({
        content: z.object({ parts: z.array(part) }).optional(),
      }),
    ),
  })
  .passthrough();

/** Native Gemini results share the existing bounded image download/storage path. */
export function normalizeGeminiReply(value: unknown): unknown {
  const parsed = nativeReply.safeParse(value);
  // Async receipts and task assets already use the common task envelope.
  if (!parsed.success) return value;
  const data = parsed.data.candidates.flatMap((candidate) =>
    (candidate.content?.parts ?? []).flatMap<{ b64_json?: string; url?: string }>((part) => {
      if (part.thought) return [];
      if (part.inlineData && imageMime.safeParse(part.inlineData.mimeType).success)
        return [{ b64_json: part.inlineData.data }];
      if (part.fileData && imageMime.safeParse(part.fileData.mimeType).success)
        return [{ url: part.fileData.fileUri }];
      return [];
    }),
  );
  return { ...parsed.data, data };
}
