import {
  checkoutPackSchema,
  defaultCreditOfferEnd,
  imageUnitCredits,
  walletSourceSchema,
} from "@lycoboai/contracts";
import type { Hono } from "hono";
import { z } from "zod";
import { enterprisePrincipal } from "../auth/principal";
import { type Env, fail, type ImageApiDependencies } from "../images/route-context";

const entryIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((value) => value.length < 19 || value <= "9223372036854775807");
const historyCursorSchema = z
  .string()
  .max(64)
  .transform((value) => value.split("/"))
  .pipe(z.tuple([z.iso.datetime(), z.enum(["0", "1"]), entryIdSchema]));

/** 注册共享积分余额、收支明细与充值订单的读取接口。 */
export function registerImageWallet(app: Hono<Env>, deps: ImageApiDependencies) {
  app.get("/wallet", async (c) => {
    const scope = c.get("principal");
    const [{ balance }, purchasedBalance] = await Promise.all([
      deps.repository.wallet(scope),
      deps.billing?.balance(scope).catch(() => null),
    ]);
    return c.json({ balance, unitCredits: imageUnitCredits, purchasedBalance });
  });
  app.get("/wallet/checkout", async (c) =>
    c.json(
      deps.checkout
        ? await deps.checkout.options(c.get("principal"))
        : { packs: [], offerEnd: defaultCreditOfferEnd },
    ),
  );
  app.post("/wallet/checkout", async (c) => {
    const identity = deps.auth && (await enterprisePrincipal(c, deps.auth));
    if (!identity) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    const input = z
      .strictObject({ pack: checkoutPackSchema, key: z.uuid() })
      .safeParse(await c.req.json());
    if (!input.success) return fail(c, "VALIDATION_ERROR", "请选择有效的积分包", 400);
    if (!deps.checkout) return fail(c, "BILLING_UNAVAILABLE", "积分购买暂不可用", 503);
    return c.json(await deps.checkout.checkout(identity.user, input.data.key, input.data.pack));
  });
  app.get("/wallet/entries", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        view: z.enum(["spent", "earned"]).optional(),
        source: walletSourceSchema.default("local"),
        before: entryIdSchema.optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    const { limit, before, view, source } = parsed.data;
    const scope = c.get("principal");
    if (source === "local")
      return c.json({ data: await deps.repository.walletEntries(scope, limit, before, view) });
    const data = deps.billing
      ? await deps.repository.billingEntries(scope, deps.billing.provider, limit, before, view)
      : [];
    return c.json({ data });
  });
  app.get("/wallet/history", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        view: z.enum(["spent", "earned"]).optional(),
        before: historyCursorSchema.optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    const { limit, view, before } = parsed.data;
    return c.json(await deps.repository.walletHistory(c.get("principal"), limit, view, before));
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
      data: await deps.repository.billingOrders(
        c.get("principal"),
        parsed.data.limit,
        parsed.data.before,
      ),
    });
  });
}
