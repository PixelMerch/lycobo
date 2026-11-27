import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { HeaderBenefits } from "./header-benefits";

const { wallet } = vi.hoisted(() => ({ wallet: vi.fn() }));

vi.mock("../../../i18n/locale-store", () => ({
  useLocale: () => "zh-CN",
  currentLocale: () => "zh-CN",
}));

vi.mock("../wallet-client", () => ({
  useWallet: wallet,
}));

it("renders a skeleton before the first balance arrives", () => {
  wallet.mockReturnValue({ isDataPending: true });
  const html = renderToStaticMarkup(createElement(HeaderBenefits));

  expect(html).toContain('aria-label="正在加载积分余额"');
  expect(html).toContain("data-value-skeleton");
  expect(html).not.toContain(">—<");
});

it("keeps the balance visible while cached data refreshes", () => {
  wallet.mockReturnValue({
    data: { balance: 500, purchasedBalance: 15 },
    isDataPending: false,
    isFetching: true,
  });
  const html = renderToStaticMarkup(createElement(HeaderBenefits));

  expect(html).toContain(">515<");
  expect(html).not.toContain("data-value-skeleton");
});
