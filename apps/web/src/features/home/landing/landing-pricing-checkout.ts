import { checkoutPackSchema } from "@lycoboai/contracts";

const storageKey = "lycobo.pricing-checkout";
const intentParameter = "checkoutIntent";

/** 只有用户发起的购买，才可在第三方登录返回后续接。 */
export function rememberPricingCheckout(pack: string) {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ id, pack }));
    return `/?${new URLSearchParams({ [intentParameter]: id })}#pricing`;
  } catch {
    return "/#pricing";
  }
}

/** 登录弹框关闭或原地登录成功后，清掉第三方登录的续接记录。 */
export function clearPricingCheckout() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // 浏览器禁用存储时，仍可在页面上重新选择档位。
  }
}

/** 校验当前标签页发起的登录意图，只消费一次。 */
export function consumePricingCheckout(search: string) {
  const id = new URLSearchParams(search).get(intentParameter);
  if (!id) return;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    const intent: unknown = JSON.parse(raw);
    if (!intent || typeof intent !== "object" || !("id" in intent) || intent.id !== id) return;
    sessionStorage.removeItem(storageKey);
    return "pack" in intent ? checkoutPackSchema.safeParse(intent.pack).data : undefined;
  } catch {
    return;
  }
}
