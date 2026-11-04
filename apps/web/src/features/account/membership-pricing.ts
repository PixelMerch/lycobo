/** Oii public pricing, checked 2026-11-02 and re-checked 2026-11-03. Display only; no payment SKU. */
export type MembershipCycle = "monthly" | "quarterly" | "yearly";
export const membershipCycles = [
  { id: "yearly", label: "年付", months: 12, unit: "/ 年" },
  { id: "quarterly", label: "季付", months: 3, unit: "/ 季" },
  { id: "monthly", label: "月付", months: 1, unit: "/ 月" },
] as const;

export interface MembershipPlan {
  id: string;
  name: string;
  options: readonly {
    credits: number;
    original: number;
    label: string;
    monthly: number;
    quarterly: number;
    yearly: number;
  }[];
}

export const membershipPricing: readonly MembershipPlan[] = [
  {
    id: "base",
    name: "BASE",
    options: [
      {
        credits: 1310,
        original: 133,
        label: "1.3k",
        monthly: 88,
        quarterly: 259,
        yearly: 999,
      },
    ],
  },
  {
    id: "star",
    name: "STAR",
    options: [
      {
        credits: 3930,
        original: 399,
        label: "3.9k",
        monthly: 259,
        quarterly: 717,
        yearly: 2868,
      },
    ],
  },
  {
    id: "pro",
    name: "PRO",
    options: [
      {
        credits: 6050,
        original: 598.5,
        label: "6k",
        monthly: 398,
        quarterly: 999,
        yearly: 3899,
      },
      {
        credits: 9550,
        original: 1064,
        label: "9.6k",
        monthly: 628,
        quarterly: 1557,
        yearly: 6108,
      },
      {
        credits: 13550,
        original: 1596,
        label: "13.6k",
        monthly: 891,
        quarterly: 2199,
        yearly: 8388,
      },
    ],
  },
  {
    id: "apex",
    name: "APEX",
    options: [
      {
        credits: 19860,
        original: 2394,
        label: "19.9k",
        monthly: 1290,
        quarterly: 3027,
        yearly: 11988,
      },
      {
        credits: 31860,
        original: 3990,
        label: "31.9k",
        monthly: 2069,
        quarterly: 4797,
        yearly: 17988,
      },
    ],
  },
] as const;

// Per-seat team prices from the same public price page; seat controls do not provision accounts.
export const teamMembershipPricing: readonly MembershipPlan[] = [
  {
    id: "team-lite",
    name: "TEAM LITE",
    options: [
      { credits: 4930, original: 615, label: "4.9k", monthly: 399, quarterly: 987, yearly: 3828 },
    ],
  },
  {
    id: "team-plus",
    name: "TEAM PLUS",
    options: [
      {
        credits: 17240,
        original: 2462,
        label: "17.2k",
        monthly: 1299,
        quarterly: 3687,
        yearly: 14748,
      },
    ],
  },
  {
    id: "team-pro",
    name: "TEAM PRO",
    options: [
      {
        credits: 28550,
        original: 4154,
        label: "28.6k",
        monthly: 2079,
        quarterly: 4797,
        yearly: 18948,
      },
    ],
  },
  {
    id: "team-max",
    name: "TEAM MAX",
    options: [
      {
        credits: 47550,
        original: 7077,
        label: "47.6k",
        monthly: 3398,
        quarterly: 7797,
        yearly: 29748,
      },
    ],
  },
];

type MembershipOption = MembershipPlan["options"][number];
const cycleMonths = (cycle: MembershipCycle) =>
  membershipCycles.find((item) => item.id === cycle)?.months ?? 12;

/** Cycle price against the struck-through price, in 折 with one decimal (8388 of 19152 → 4.4). */
export function discountTenths(option: MembershipOption, cycle: MembershipCycle) {
  return Math.round((option[cycle] / (option.original * cycleMonths(cycle))) * 100) / 10;
}

/** Yuan per credit for one month of the cycle, the figure each plan card highlights. */
export function creditPrice(option: MembershipOption, cycle: MembershipCycle) {
  return option[cycle] / cycleMonths(cycle) / option.credits;
}

/** The deepest discount any plan reaches in this cycle, shown next to the cycle choice. */
export function lowestDiscount(plans: readonly MembershipPlan[], cycle: MembershipCycle) {
  return Math.min(
    ...plans.flatMap((plan) => plan.options.map((option) => discountTenths(option, cycle))),
  );
}

/** The cheapest credit any plan reaches in this cycle. */
export function lowestCreditPrice(plans: readonly MembershipPlan[], cycle: MembershipCycle) {
  return Math.min(
    ...plans.flatMap((plan) => plan.options.map((option) => creditPrice(option, cycle))),
  );
}

/** The plan holding the cheapest credit of this cycle; its card carries the highlight. */
export function cheapestPlanId(plans: readonly MembershipPlan[], cycle: MembershipCycle) {
  const lowest = lowestCreditPrice(plans, cycle);
  return plans.find((plan) => plan.options.some((option) => creditPrice(option, cycle) === lowest))
    ?.id;
}
