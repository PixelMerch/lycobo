export type AdFormat = "compact" | "mid" | "wide";

export interface CaseCard {
  title: string;
  image: string;
  format: AdFormat;
}

export const caseCards: CaseCard[] = [
  { title: "E-commerce Visuals", image: "/vidmuse/case-ecommerce.webp", format: "compact" },
  { title: "Brand Kits", image: "/vidmuse/case-brand-kits.webp", format: "wide" },
  { title: "Real Estate Video Tours", image: "/vidmuse/case-realestate.webp", format: "mid" },
  { title: "UGC Shorts", image: "/vidmuse/case-ugc.webp", format: "mid" },
  { title: "Product Demos", image: "/vidmuse/case-demos.webp", format: "mid" },
  { title: "In-feed Ads", image: "/vidmuse/case-infeed.webp", format: "mid" },
  { title: "Brand Showcase", image: "/vidmuse/template-luxury.webp", format: "compact" },
  { title: "Influencer Reviews", image: "/vidmuse/template-thread.webp", format: "mid" },
  { title: "Promo Ads", image: "/vidmuse/template-outfit.webp", format: "mid" },
  { title: "Social Ads", image: "/vidmuse/post-pic.webp", format: "mid" },
];

export const competitors = [
  {
    id: "A",
    label: "Your product",
    image: "/vidmuse/can-a.webp",
    note: "Hook +12 · Proof +8",
    bars: [45, 65, 85],
  },
  {
    id: "B",
    label: "Competitor B",
    image: "/vidmuse/can-b.webp",
    note: "vs you · Hook −12 · Proof −8",
    bars: [38, 52, 71],
  },
  {
    id: "C",
    label: "Competitor C",
    image: "/vidmuse/can-c.webp",
    note: "vs you · Hook −18 · Offer −6",
    bars: [30, 46, 58],
  },
  {
    id: "D",
    label: "Competitor D",
    image: "/vidmuse/can-d.webp",
    note: "vs you · Pacing −9 · CTA −11",
    bars: [42, 55, 62],
  },
];

export const scoreCards = [
  { score: 86, dimension: "CTA", caption: "Drive action", icon: "/vidmuse/score-cta.svg" },
  {
    score: 82,
    dimension: "Offer",
    caption: "Make it compelling",
    weakest: true,
    icon: "/vidmuse/score-offer.svg",
  },
  { score: 94, dimension: "Hook", caption: "Stop the scroll", icon: "/vidmuse/score-hook.svg" },
  { score: 89, dimension: "Pacing", caption: "Keep attention", icon: "/vidmuse/score-pacing.svg" },
  { score: 91, dimension: "Proof", caption: "Build trust", icon: "/vidmuse/score-proof.svg" },
];

export const kitVideos = [1, 2, 3, 4, 5, 6].map((n) => `/vidmuse/create-video-${n}.webp`);
export const kitFeeds = [1, 2, 3, 4].map((n) => `/vidmuse/kit-feed-${n}.webp`);
export const kitCovers = [1, 2, 4, 5, 6, 8, 9].map((n) => `/vidmuse/kit-cover-${n}.webp`);
export const kitCtas = [1, 2, 3, 4, 5, 6].map((n) => `/vidmuse/kit-cta-${n}.webp`);

export const copyVariants = [
  {
    group: "Hooks",
    items: [
      "The 10-second skincare routine dermatologists keep quiet about.",
      "I tested 27 serums. This is the only one I re-bought.",
      "Your skin is thirsty. This is the glass of water.",
    ],
  },
  {
    group: "Captions",
    items: [
      "Glow that survives a 14-hour day. Tap to make it yours.",
      "Real results, real texture, zero filter. Meet your new ritual.",
      "The serum everyone is talking about — now in your routine.",
    ],
  },
  {
    group: "Headlines",
    items: [
      "One drop. All-day glow.",
      "Skin that looks lit from within.",
      "The 3-second absorption your skin remembers.",
    ],
  },
];

export const impactStats = [
  { value: "45%", label: "Lower CPA", icon: "/vidmuse/ic-cpa.svg" },
  { value: "3X", label: "Higher return on ad spend", icon: "/vidmuse/ic-roas.svg" },
  { value: "97%", label: "Less production time", icon: "/vidmuse/ic-time.svg" },
];

export interface CampaignFormat {
  title: string;
  description: string;
  image: string;
}

export const campaignFormats: CampaignFormat[] = [
  {
    title: "Luxury Product Model Showcase",
    description: "Turn Your Product into a High-End Cinematic Ad",
    image: "/vidmuse/template-luxury.webp",
  },
  {
    title: "Thread to Tread",
    description: "A creation story for your product.",
    image: "/vidmuse/template-thread.webp",
  },
  {
    title: "Turn Illustrations into 3D Products",
    description: "Showcase Your Product with Creative Illustrations",
    image: "/vidmuse/template-illustrations.webp",
  },
  {
    title: "Outfit Switch",
    description: "Turn one portrait into a seamless outfit transition video.",
    image: "/vidmuse/template-outfit.webp",
  },
  {
    title: "Trendy Top Showcase",
    description: "From a single thread to a statement piece.",
    image: "/vidmuse/template-trendy.webp",
  },
  {
    title: "World Cup Goal Moments Product Showcase",
    description: "Let Football Superstars Take Your Product to the World Cup Stage",
    image: "/vidmuse/template-worldcup.webp",
  },
];
