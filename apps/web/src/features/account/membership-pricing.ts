/** Oii public personal pricing, checked 2026-11-02. Display only; no payment SKU. */
export type MembershipCycle = "monthly" | "quarterly" | "yearly";
export const membershipCycles = [
  { id: "yearly", label: "年付", months: 12, unit: "/ 年" },
  { id: "quarterly", label: "季付", months: 3, unit: "/ 季" },
  { id: "monthly", label: "月付", months: 1, unit: "/ 月" },
] as const;

export const membershipPricing = [
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
