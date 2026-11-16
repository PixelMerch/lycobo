# Web rules

Root AGENTS.md applies. Read the React and HeroUI skills and use the
[task map](../../docs/ai-workflow.md#按任务读取) to open the relevant
[DESIGN.md](../../DESIGN.md) sections, including named exceptions. DESIGN is the sole
visual specification. Preserve the approved UI during cleanup or refactors.

## Components and data

- Use installed HeroUI v3 APIs for interactive controls. Check the [component inventory](../../docs/heroui-components.md)
  and [UI guidelines](../../docs/ui-consistency.md). Compose official components with size/variant/isIconOnly.
  Use shared tokens and overlay styles. No second primitive system, base-control wrappers, homemade
  dialogs, focus traps or keyboard menus. Keep scripts/check-ui-conventions.mjs enabled.
- Use Tabler via UiIcon. Follow DESIGN for sizes, glass materials, navigation, focus and named exceptions.
  Keep accessible names, keyboard focus, semantic controls, reduced motion and narrow-screen behavior.
  Cover keyboard-only brand focus and React Aria hover/programmatic focus behavior in the CI browser suite.
- Route pages live in src/features and the shared shell in src/app. Use concrete imports, lazy routes
  for heavy canvas/editor pages and AbortSignal-aware API requests. Full-resolution originals stay out of grid cards.
- Use TanStack Query for server data, Zustand for client interaction and render-time derivation for computed values.
  Effects synchronize external systems. Pages compose features; hooks own external synchronization.
  Preserve DOM semantics, classes, focus and paid-task behavior during refactors.
- APIs use relative /api paths. Local upload previews stay local until submission; the server
  validates and stores files. Public demos and CI fixtures are distinct from image APIs and durable services.
- Use locale-prefixed page URLs, RouteLink, useAppNavigate and useAppLocation. Preserve locale on
  login and result links; never prefix API, WebSocket, image or font URLs. Follow [locale routing](../../docs/localized-routing.md).
  Preserve pending drafts across tools and keep users on their current page when a background task finishes.

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
