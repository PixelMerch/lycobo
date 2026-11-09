# Web rules

Root AGENTS.md applies. Before editing, read the React skill and the relevant DESIGN.md
sections via docs/ai-workflow.md. Read common visual rules and any named local exceptions;
DESIGN.md remains the sole visual specification, not this routing guide.
Use official HeroUI v3 APIs installed in package.json, not v2 examples; read the HeroUI skill
and installed-version docs before using components. UI/UX skill advice cannot restyle the product.
Keep route pages in src/features and shared application shell in src/app.
Use concrete feature imports, route-level lazy loading and AbortSignal-aware requests.
All API paths are relative /api; never read private runtime environment values.
Local uploads stay preview-only until submission; the server validates and stores them.

## Frontend and design

- HeroUI is the only interactive component system. Compose official components; no shadcn,
  second primitive system, homemade dialogs, focus traps or dropdown keyboards.
  Check docs/heroui-components.md for the installed component inventory before building
  any control, overlay, field, state or navigation element by hand. Read docs/ui-consistency.md
  for the shared control density and audit workflow. Use HeroUI size/variant/isIconOnly;
  geometry belongs to DESIGN.md tokens, not inline styles or a new AppButton wrapper.
  pnpm lint enforces scripts/check-ui-conventions.mjs; do not bypass its component checks.
- All new and updated overlays (Modal, Drawer, Popover, Dropdown, Tooltip and Toast) use
  the shared frosted-glass material in styles/overlay-glass.css and DESIGN.md. Preserve readable
  contrast, reduced-transparency fallback and native HeroUI focus handling; never add an opaque
  surface as a local default. The standalone login page uses the same dark-glass material and swaps its two faces.
  The full-screen membership page is an explicit exception: opaque background, no backdrop blur
  or modal fade/scale transitions.
- Follow PRD.md for navigation: Home, Workspace, Asset Library. The workspace holds four tools
  (main image, textile variation, image-set plan, video) that switch through the tool dock.
  TK has no current navigation entry.
- DESIGN.md is the sole visual specification. The user approved and froze the current UI on
  2026-10-22. Documentation, cleanup and component refactors must preserve its appearance;
  a new visual change requires a new explicit design request. Do not reinterpret skill recommendations
  as permission to restyle it. Preserve the actual tokens: brand lime #A8FF00, HeroUI accent
  #A8FF00, lime-to-mint primary gradient (#A8FF00 → #54E6A5) with dark #142000 foreground and pill-shaped generation buttons.
  Image content stays primary. Do not reintroduce retired palettes or bonko branding.
- Distinguish real image APIs from local examples and E2E fixtures. Never represent sample
  content, client-only favorites or future payment/sign-in rewards as durable production services.
- Keep page components focused on composition. Extract complete reusable features into components
  and external synchronization into hooks; preserve DOM semantics, classes, focus and paid-task
  behavior during refactors. Do not create another base-control wrapper or split components at an arbitrary line.
- Use TanStack Query for server data, Zustand only for client interaction state. Derive values during
  render; effects synchronize external systems, not redundant state.
- Lazy-load heavy canvas/editor routes. Do not load original full-resolution images into grid cards.
- Accessible labels, visible focus, semantic controls, reduced motion and narrow-screen behavior
  are required. Signed out, the header keeps the borderless pill-shaped login action; signed in,
  it shows shared credits and membership entries. Accounts and notifications remain in the sidebar;
  do not restore task-center or notification entries in the header.
- Keep the brand focus ring keyboard-only. React Aria moves focus on hover, restored focus and
  programmatic opens, and Chromium reports those moves as `:focus-visible`; suppress the ring for
  pointer focus (`data-focused` without `data-focus-visible`) and for HeroUI overlay containers
  (dialog, popover, dropdown menu). No purple box around the account capsule, menu list, row or
  dialog after hover or click. Cover this with E2E assertions, not only CSS.
- Signed in, the account capsule sits at the foot of the sidebar (the navigation drawer on phones)
  and opens its menu upward on press, Enter or Space, as in the approved 小云雀 reference; hovering
  does not open it. Keyboard focus enters the first row and returns to the capsule on close.
- Preserve pending drafts when switching tasks. Never navigate users away when a background task completes.
- Product screens use end-user language. Keep preview/debug/reset notes in developer documentation, not headers, cards or dialogs. Never infer production readiness from clean UI copy.
- Match the measured shell rules in DESIGN.md: sidebar 274/288/320px by breakpoint, collapsed 64px (2× the 32px icon background); desktop rows 40/42/44px, row gap 6px, icon/text gap 8px, pill radius 999px, icons 18px. Header is 60px on desktop and mobile. Hover/active never change geometry; mobile targets stay 44px.
- Use Tabler business icons through components/ui-icon.tsx. Sizes: 14 / 18 / 20 / 22 / 28px, stroke 2. Keep icon sizing independent of compact control geometry; do not add another icon library. Credits use Tabler IconCoins (no bitmap coin) and close controls use Tabler IconX; never keep hand-drawn, bitmap or second-library icons.
- Sidebar text/icons use neutral gray-white: default #FFFFFFB3, hover fill #FFFFFF0A, active fill #FFFFFF14 with white text/icons. Do not restore purple navigation labels. Chevrons rotate left on expansion and respect reduced motion. Tool selectors use spacing instead of extra divider lines.
- No server modules or secrets in apps/web or packages/contracts. VITE_* is public.
- UI mockups are references, never a screenshot used as a functional page.
