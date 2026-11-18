# Web rules

Root AGENTS.md applies. Read the React and HeroUI skills. Use the existing
styles, shared tokens and named exceptions as the reference when preserving approved UI.

## Components and data

- Use installed HeroUI v3 APIs for interactive controls. Check the [component inventory](../../docs/heroui-components.md)
  and compose official components with size/variant/isIconOnly.
  Use shared tokens and overlay styles. No second primitive system, base-control wrappers, homemade
  dialogs, focus traps or keyboard menus. Keep scripts/check-ui-conventions.mjs enabled.
- Use Tabler via UiIcon. Use existing shared sizes, glass materials, navigation and focus styles.
  Keep accessible names, keyboard focus, semantic controls, reduced motion and narrow-screen behavior.
  Preserve existing overlay dimensions and tokens. Prefer hover feedback that keeps geometry stable.
  Cover keyboard-only brand focus and React Aria hover/programmatic focus behavior in the CI browser suite.
- Route pages live in src/features and the shared shell in src/app. Use concrete imports, lazy routes
  for heavy canvas/editor pages and AbortSignal-aware API requests. Full-resolution originals stay out of grid cards.
- Use TanStack Query for server data, Zustand for client interaction and render-time derivation for computed values.
  Effects synchronize external systems. Pages compose features; hooks own external synchronization.
  Preserve DOM semantics, classes, focus and paid-task behavior during refactors.
- APIs use relative /api paths. Local upload previews stay local until submission; the server
  validates and stores files. Public demos and CI fixtures are distinct from image APIs and durable services.
- Use locale-prefixed page URLs and RouteLink, useAppNavigate and useAppLocation. Explicit URL locale wins over saved preference and browser default. Preserve path, query, hash, history state, scroll, drafts and live connections on language changes. Read the current locale on navigation, and validate login returns against allowed business paths. Keep API, WebSocket and asset paths unprefixed. Keep users on their current page when a background task finishes.

## UI text

- Every visible or accessible string, toast and client error uses a colocated *-messages.ts catalog
  with defineMessages. zh-CN sets the shape and en matches it. Use useMessages in React and currentMessages
  elsewhere. Format dates and numbers in the current locale. Map server error codes to English in
  lib/server-error.ts, and show the server's Chinese message in Chinese mode. Preserve user input,
  generated plans, model instructions and protocol markers such as @图片N. Keep scripts/check-ui-text.mjs enabled.
- Use essential copy: concise titles, action and comparison labels, required legal and accessibility
  text, validation and error feedback. Avoid slogans, repeated instructions, implementation notes,
  debug/reset copy and filler like “Sample images” or “效果示例” unless requested or needed to avoid a
  concrete misunderstanding. Keep provenance in docs; never imply fixtures are customer or production results.
