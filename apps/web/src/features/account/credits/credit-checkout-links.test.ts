import { describe, expect, it } from "vitest";
import { parseCreditCheckoutLinks } from "./credit-checkout-links";
import { cnyPerUsdEstimate, creditPackDisplay, creditPacks } from "./credit-pack-pricing";

describe("credit pack checkout links", () => {
  it("selects the correct checkout when different packs share a price", () => {
    const standard = "https://www.creem.io/payment/prod_standard_fixture";
    const offer = "https://www.creem.io/payment/prod_offer_fixture";
    const links = parseCreditCheckoutLinks(
      JSON.stringify({ "regular:5999": standard, "offer:5999": offer }),
    );
    const catalog = creditPackDisplay(creditPacks[2], "en", 2);
    const production = creditPackDisplay(creditPacks[3], "en", 2, true);
    expect(catalog.price).toBe(production.price);
    expect(links.get(catalog.checkoutKey)).toBe(standard);
    expect(links.get(production.checkoutKey)).toBe(offer);
    expect(links.get(creditPackDisplay(creditPacks[0], "en", 2).checkoutKey)).toBeUndefined();
  });

  it("keeps the base estimate around 0.40 CNY and makes bigger offers cheaper per image", () => {
    let previousBonusRate = 0;
    let previousImageRate = 0.45;
    for (const pack of creditPacks) {
      const estimatedCny = (pack.offerAmountMinor / 100) * cnyPerUsdEstimate;
      const bonusRate = pack.bonusCredits / pack.credits;
      const imageRate = estimatedCny / ((pack.credits + pack.bonusCredits) / 2);
      expect(estimatedCny / (pack.credits / 2)).toBeCloseTo(0.4, 2);
      expect(bonusRate).toBeGreaterThan(previousBonusRate);
      expect(imageRate).toBeGreaterThanOrEqual(0.35);
      expect(imageRate).toBeLessThan(previousImageRate);
      previousBonusRate = bonusRate;
      previousImageRate = imageRate;
    }
    expect(creditPacks.map((pack) => pack.offerAmountMinor)).toEqual([299, 1999, 3999, 5999, 9999]);
    const offers = creditPacks.map((pack) => creditPackDisplay(pack, "en", 2, true));
    expect(offers.map((pack) => pack.regularPrice)).toEqual([
      "$4.49",
      "$29.99",
      "$59.99",
      "$89.99",
      "$149.99",
    ]);
    expect(offers.map((pack) => pack.cnyImageRate)).toEqual([
      "¥0.39",
      "¥0.38",
      "¥0.37",
      "¥0.36",
      "¥0.35",
    ]);
  });

  it("drops ambiguous keys and malformed or non-Creem addresses", () => {
    expect(parseCreditCheckoutLinks("unconfigured").size).toBe(0);
    expect(
      parseCreditCheckoutLinks(
        JSON.stringify({
          299: "https://www.creem.io/payment/prod_ambiguous_fixture",
          "offer:299": "https://creem.io.example.com/payment/prod_fixture",
          "regular:449": "http://www.creem.io/payment/prod_fixture",
          "offer:1999": "https://example.com",
          "regular:2999": "https://www.creem.io",
        }),
      ).size,
    ).toBe(0);
  });
});
