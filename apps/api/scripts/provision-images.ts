import { openImageRepository } from "@lycoboai/db";
import { z } from "zod";

const parsed = z
  .object({
    DATABASE_URL: z.url(),
    IMAGE_ADMIN_SUBJECT: z.string().min(1).max(200),
    IMAGE_ORGANIZATION_NAME: z.string().min(1).max(100),
    IMAGE_INITIAL_CREDITS: z.coerce.number().int().min(0).max(100000000),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(
    "Set DATABASE_URL, IMAGE_ADMIN_SUBJECT, IMAGE_ORGANIZATION_NAME and IMAGE_INITIAL_CREDITS",
  );
const repository = openImageRepository(parsed.data.DATABASE_URL);
try {
  const result = await repository.provision(
    parsed.data.IMAGE_ADMIN_SUBJECT,
    parsed.data.IMAGE_ORGANIZATION_NAME,
    parsed.data.IMAGE_INITIAL_CREDITS,
  );
  // Explicit local operator output, never an API endpoint or application log.
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await repository.close();
}
