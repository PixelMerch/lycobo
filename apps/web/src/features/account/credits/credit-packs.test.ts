import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { ImageApiError } from "../../generation/image-request";
import { CreditPacks } from "./credit-packs";

const { checkout } = vi.hoisted(() => ({ checkout: vi.fn() }));
vi.mock("../../../i18n/locale-store", () => ({
  useLocale: () => "zh-CN",
  currentLocale: () => "zh-CN",
}));
vi.mock("../wallet-client", () => ({
  useCreditCheckout: checkout,
  useWallet: () => ({ data: { unitCredits: 2 } }),
  useCheckoutOptions: () => ({
    data: { offerEnd: "2099-01-01T00:00:00Z", packs: ["offer:trial", "offer:bulk"] },
  }),
}));

afterEach(() => checkout.mockReset());

it("marks the clicked pack pending and blocks the other buy buttons", () => {
  checkout.mockReturnValue({ isOpening: true, variables: "offer:trial", error: null });
  const html = renderToStaticMarkup(createElement(CreditPacks));

  expect(html).toContain("正在打开支付页面");
  expect(html.match(/data-pending="true"/g)).toHaveLength(1);
  expect(html).toContain('data-slot="spinner"');
  expect(html).toMatch(/<button(?=[^>]*aria-label="购买 4,800 积分")(?=[^>]* disabled="")[^>]*>/);
});

it("surfaces the payment error inside the recharge dialog content", () => {
  checkout.mockReturnValue({
    isOpening: false,
    variables: "offer:trial",
    error: new ImageApiError("积分结算暂不可用，请稍后重试。", 503, "BILLING_UNAVAILABLE"),
  });
  const html = renderToStaticMarkup(createElement(CreditPacks));

  expect(html).toMatch(/role="alert"[^>]*>积分结算暂不可用，请稍后重试。/);
});
