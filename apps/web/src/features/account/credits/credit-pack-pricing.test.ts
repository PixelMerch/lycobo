import { creditPacks } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { cnyPerUsdEstimate, creditPackDisplay } from "./credit-pack-pricing";

describe("credit pack display", () => {
  it("keeps offer and regular checkout keys distinct even when their prices match", () => {
    const catalog = creditPackDisplay(creditPacks[2], "en", 2);
    const production = creditPackDisplay(creditPacks[3], "en", 2, true);
    expect(catalog.price).toBe(production.price);
    expect(catalog.checkoutKey).toBe("regular:catalog");
    expect(production.checkoutKey).toBe("offer:production");
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
});
