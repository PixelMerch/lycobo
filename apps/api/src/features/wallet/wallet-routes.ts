import { imageUnitCredits } from "@lycoboai/contracts";
import type { Hono } from "hono";
import { z } from "zod";
import { type Env, fail, type ImageApiDependencies } from "../images/route-context";

export function registerImageWallet(app: Hono<Env>, deps: ImageApiDependencies) {
  app.get("/wallet", async (c) =>
    c.json({
      ...(await deps.repository.wallet(c.get("principal"))),
      unitCredits: imageUnitCredits,
    }),
  );
  app.get("/wallet/entries", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,18}$/)
          .refine((value) => BigInt(value) <= 9223372036854775807n)
          .optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    return c.json({
      data: await deps.repository.walletEntries(
        c.get("principal"),
        parsed.data.limit,
        parsed.data.before,
      ),
    });
  });
  app.get("/wallet/recharges", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z.uuid().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    return c.json({
      data: await deps.repository.rechargeOrders(
        c.get("principal"),
        parsed.data.limit,
        parsed.data.before,
      ),
    });
  });
}
