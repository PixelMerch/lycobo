export type AdFormat = "compact" | "mid" | "wide";

export interface CaseCard {
  title: string;
  image: string;
  format: AdFormat;
}

export const caseCards: CaseCard[] = [
  { title: "E-commerce Visuals", image: "/landing/case-ecommerce.webp", format: "compact" },
  { title: "Brand Kits", image: "/landing/case-brand-kits.webp", format: "wide" },
  { title: "Real Estate Video Tours", image: "/landing/case-realestate.webp", format: "mid" },
  { title: "UGC Shorts", image: "/landing/case-ugc.webp", format: "mid" },
  { title: "Product Demos", image: "/landing/case-demos.webp", format: "mid" },
  { title: "In-feed Ads", image: "/landing/case-infeed.webp", format: "mid" },
  { title: "Brand Showcase", image: "/landing/template-luxury.webp", format: "compact" },
  { title: "Influencer Reviews", image: "/landing/template-thread.webp", format: "mid" },
  { title: "Promo Ads", image: "/landing/template-outfit.webp", format: "mid" },
  { title: "Social Ads", image: "/landing/post-pic.webp", format: "mid" },
];

export const competitors = [
  {
    id: "A",
    label: "Your product",
    image: "/landing/can-a.webp",
    note: "Hook +12 · Proof +8",
    bars: [45, 65, 85],
  },
  {
    id: "B",
    label: "Competitor B",
    image: "/landing/can-b.webp",
    note: "vs you · Hook −12 · Proof −8",
    bars: [38, 52, 71],
  },
  {
    id: "C",
    label: "Competitor C",
    image: "/landing/can-c.webp",
    note: "vs you · Hook −18 · Offer −6",
    bars: [30, 46, 58],
  },
  {
    id: "D",
    label: "Competitor D",
    image: "/landing/can-d.webp",
    note: "vs you · Pacing −9 · CTA −11",
    bars: [42, 55, 62],
  },
];

export const scoreCards = [
  { score: 86, dimension: "CTA", caption: "Drive action", icon: "/landing/score-cta.svg" },
  {
    score: 82,
    dimension: "Offer",
    caption: "Make it compelling",
    weakest: true,
    icon: "/landing/score-offer.svg",
  },
  { score: 94, dimension: "Hook", caption: "Stop the scroll", icon: "/landing/score-hook.svg" },
  { score: 89, dimension: "Pacing", caption: "Keep attention", icon: "/landing/score-pacing.svg" },
  { score: 91, dimension: "Proof", caption: "Build trust", icon: "/landing/score-proof.svg" },
];

export const kitVideos = [1, 2, 3, 4, 5, 6].map((n) => `/landing/create-video-${n}.webp`);
export const kitFeeds = [1, 2, 3, 4].map((n) => `/landing/kit-feed-${n}.webp`);
export const kitCovers = [1, 2, 4, 5, 6, 8, 9].map((n) => `/landing/kit-cover-${n}.webp`);
export const kitCtas = [1, 2, 3, 4, 5, 6].map((n) => `/landing/kit-cta-${n}.webp`);

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
  { value: "45%", label: "Lower CPA", icon: "/landing/ic-cpa.svg" },
  { value: "3X", label: "Higher return on ad spend", icon: "/landing/ic-roas.svg" },
  { value: "97%", label: "Less production time", icon: "/landing/ic-time.svg" },
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
    image: "/landing/template-luxury.webp",
  },
  {
    title: "Thread to Tread",
    description: "A creation story for your product.",
    image: "/landing/template-thread.webp",
  },
  {
    title: "Turn Illustrations into 3D Products",
    description: "Showcase Your Product with Creative Illustrations",
    image: "/landing/template-illustrations.webp",
  },
  {
    title: "Outfit Switch",
    description: "Turn one portrait into a seamless outfit transition video.",
    image: "/landing/template-outfit.webp",
  },
  {
    title: "Trendy Top Showcase",
    description: "From a single thread to a statement piece.",
    image: "/landing/template-trendy.webp",
  },
  {
    title: "World Cup Goal Moments Product Showcase",
    description: "Let Football Superstars Take Your Product to the World Cup Stage",
    image: "/landing/template-worldcup.webp",
  },
  {
    title: "Giant Glam",
    description: "Eye-catching models, product in the spotlight.",
    image: "/landing/giant-glam.webp",
  },
  {
    title: "Flavor Burst",
    description: "Dynamic layers, instant impact. A visual burst of pure taste.",
    image: "/landing/flavor-burst.webp",
  },
  {
    title: "Red Carpet",
    description: "Grammy Red Carpet Walk",
    image: "/landing/red-carpet.webp",
  },
  {
    title: "Echoed Words",
    description: "Turn a powerful line into an iconic quote with cinematic documentary visuals.",
    image: "/landing/echoed-words.webp",
  },
];
