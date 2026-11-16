---
name: ecommerce-landing
description: Design, review, or polish an e-commerce product-image SaaS landing page for Taobao, Douyin Shop, and Shopify merchants. Use for original-versus-result product demonstrations and restrained merchant-facing marketing pages, with design-token approval and one-block-at-a-time wireframe and coding reviews. Supports --review, --polish, --hero-only, and --pricing-only. Excludes ordinary workspace UI and backend changes.
---

# E-commerce Landing

Read [the original user-provided brief](references/original-prompt.md) when this skill is invoked. It preserves the user's full visual constraints, workflow, section order, and critique checklist. Apply it together with the project integration below; the current user request determines scope.

## Invocation and modes

- `/ecommerce-landing` or `$ecommerce-landing`: follow the staged design workflow.
- `--review`: inspect the existing page and relevant code; return the seven-point critique, concrete locations, and proposed fixes. Do not edit or begin a redesign.
- `--polish`: limit proposals and edits to spacing and typography. Keep section order, imagery, colors, business logic, and interactions unchanged; use the approval stages for the affected block only.
- `--hero-only`: restrict the design workflow to the Hero.
- `--pricing-only`: restrict the design workflow to Pricing.

Read mode arguments from the invocation and accompanying user request. A review or polish mode can be combined with one section filter. If the two section filters are both requested without a clear scope, ask which section to handle first.

## Project integration

1. Read [root contributor rules](../../../AGENTS.md), [Web rules](../../../apps/web/AGENTS.md), and the task-relevant sections of [PRD](../../../PRD.md), [DESIGN](../../../DESIGN.md), and [PROJECT_STRUCTURE](../../../PROJECT_STRUCTURE.md). Follow their verification, Git, localization, and accessibility rules.
2. Keep the user's current scope. A request to preserve the Hero or navigation stays in force; a fixed page order does not authorize rewriting an excluded block. For a full-page task, use Hero → Capability → Platform → Pricing → FAQ → Footer. For a scoped task, keep that relative order and skip excluded blocks.
3. This repository uses React/Vite, TypeScript, and HeroUI. The original brief's shadcn/ui stack is a generic starting point, not permission to replace this project's primitives or install a second component system. Use the existing stack unless the user explicitly requests a migration.
4. Treat Satoshi headings and Inter body text as a proposed font configuration at the token stage. Include a Chinese font fallback using the project's existing self-hosted font. Apply approved changes only within the requested landing-page scope; do not silently replace global fonts or shared theme tokens.
5. DESIGN.md is the only visual specification. Keep proposed tokens in the review response until approved, then synchronize the relevant DESIGN section as implementation proceeds. Do not create a competing design-system document.
6. Build the visual proof from the same identifiable product before and after editing. Use project assets first; generate new assets only within the user's authorization. UI decoration follows the limited palette; product photography can retain its actual colors.
7. Check the real product before writing claims. Do not invent a public API, platform integration, commercial-rights guarantee, distortion-free guarantee, bulk export, savings figures, or production capability. Omit unsupported claims and state any capability gap in the review response, not as decorative page copy.
8. Keep Simplified Chinese and English copy in the project's message catalogs. Follow the existing component and icon conventions. Use the available `unslop` skill for additional critique when useful; the supplied checklist remains usable without installing another skill.
9. The new landing-page motion rule is subtle opacity-only scroll entry. No card flight, parallax, decorative loops, hover displacement, enlarged shadows, or glow. Respect reduced motion and avoid hiding essential content when animation is disabled. Do not alter an explicitly preserved section's existing motion.

## Staged design workflow

Resume from the last explicitly approved stage; do not ask the user to reapprove an unchanged decision.

1. **Design tokens only.** Provide primary and accent colors, five gray levels, type scale, spacing scale, radius rules, shadow rules, and font configuration. Label them as a proposal. Wait for approval before wireframing or editing the page.
2. **One block's wireframe.** Show a low-fidelity wireframe for the current block and explain image placement, text position, and layout logic. Wait for approval before coding that block. Do not present a complete page implementation.
3. **One block's implementation.** Implement only the approved block with independent components in the project. Use local visual inspection and the permitted checks. Run the original brief's seven-point critique, report the result, and wait for the user's review before moving to the next block.
4. **Final critique.** After all in-scope blocks are reviewed, check every prohibited pattern and report any remaining violation with its location and proposed fix. Complete authorized fixes through the same review process.

An approval applies to the concrete proposal and scope reviewed. This skill does not authorize dependency migrations, paid generation, publishing, pushing, merging, or deployment on its own.
