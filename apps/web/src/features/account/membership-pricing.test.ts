import { describe, expect, it } from "vitest";
import {
  cheapestPlanId,
  creditPrice,
  discountTenths,
  lowestCreditPrice,
  lowestDiscount,
  membershipCycles,
  membershipPricing,
  teamMembershipPricing,
} from "./membership-pricing";

const option = (plan: string, credits?: number) => {
  const found = [...membershipPricing, ...teamMembershipPricing]
    .find((entry) => entry.id === plan)
    ?.options.find((entry) => credits === undefined || entry.credits === credits);
  if (!found) throw new Error(`Missing ${plan}`);
  return found;
};

describe("membership price facts", () => {
  it("derives the plan badges from the yearly price and the struck-through price", () => {
    expect(discountTenths(option("base"), "yearly")).toBe(6.3);
    expect(discountTenths(option("star"), "yearly")).toBe(6);
    expect(discountTenths(option("pro", 13550), "yearly")).toBe(4.4);
    expect(discountTenths(option("apex", 31860), "yearly")).toBe(3.8);
  });

  it("matches the per-credit prices printed on the reference cards", () => {
    expect(creditPrice(option("base"), "yearly").toFixed(3)).toBe("0.064");
    expect(creditPrice(option("star"), "yearly").toFixed(3)).toBe("0.061");
    expect(creditPrice(option("pro", 13550), "yearly").toFixed(3)).toBe("0.052");
    expect(creditPrice(option("apex", 31860), "yearly").toFixed(3)).toBe("0.047");
  });

  it("names the deepest discount and cheapest credit of every cycle", () => {
    expect(lowestDiscount(membershipPricing, "yearly")).toBe(3.8);
    expect(lowestDiscount(membershipPricing, "quarterly")).toBe(4);
    expect(lowestDiscount(membershipPricing, "monthly")).toBe(5.2);
    expect(lowestDiscount(teamMembershipPricing, "yearly")).toBe(3.5);
    expect(lowestCreditPrice(membershipPricing, "yearly").toFixed(3)).toBe("0.047");
    expect(lowestCreditPrice(teamMembershipPricing, "yearly").toFixed(3)).toBe("0.052");
    for (const cycle of membershipCycles) {
      // The highlighted top plan really is the cheapest credit in every cycle and audience.
      expect(cheapestPlanId(membershipPricing, cycle.id)).toBe("apex");
      expect(cheapestPlanId(teamMembershipPricing, cycle.id)).toBe("team-max");
    }
  });
});
