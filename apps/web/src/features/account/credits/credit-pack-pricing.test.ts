import { creditPacks } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { creditPackDisplay } from "./credit-pack-pricing";

describe("credit pack display", () => {
  it("keeps offer and regular checkout keys distinct even when their prices match", () => {
    const catalog = creditPackDisplay(creditPacks[2], "en", 2);
    const production = creditPackDisplay(creditPacks[3], "en", 2, true);
    expect(catalog.price).toBe(production.price);
    expect(catalog.checkoutKey).toBe("regular:catalog");
    expect(production.checkoutKey).toBe("offer:production");
  });

  it("keeps USD prices and shows cheaper per-image estimates for larger offers", () => {
    const offers = creditPacks.map((pack) => creditPackDisplay(pack, "en", 2, true));
    expect(offers.map((pack) => pack.price)).toEqual([
      "$2.99",
      "$19.99",
      "$39.99",
      "$59.99",
      "$99.99",
    ]);
    expect(offers.map((pack) => pack.regularPrice)).toEqual([
      "$4.49",
      "$29.99",
      "$59.99",
      "$89.99",
      "$149.99",
    ]);
    expect(offers.map((pack) => pack.credits)).toEqual(["102", "700", "1,480", "2,540", "4,800"]);
    expect(offers.map((pack) => pack.bonusRate)).toEqual(["2%", "6%", "8%", "11%", "14%"]);
    expect(offers.map((pack) => pack.images)).toEqual(["52", "370", "800", "1,410", "2,740"]);
    expect(offers.map((pack) => pack.cnyImageRate)).toEqual([
      "¥0.39",
      "¥0.37",
      "¥0.34",
      "¥0.29",
      "¥0.25",
    ]);
  });
});
