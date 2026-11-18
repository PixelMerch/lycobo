# Lycobo contributor rules

## Scope and implementation

- Check Git status, applicable AGENTS.md files, [engineering index](docs/README.md) and the relevant implementation before editing. Preserve unrelated work and approved UI. Read the applicable [skills](.agents/skills) for React, HeroUI, PostgreSQL, security-sensitive work or landing design. Verify installed APIs, pin direct dependencies and keep Vite/TanStack Query. Keep skill versions locked and review upstream changes before updating.
- Use English identifiers and rules, Chinese team docs and code comments. Add a purpose comment to new or changed exported functions, classes and React components. Explain non-obvious permissions, billing, idempotency, retries and timeouts. Follow [server layering and comment rules](docs/node-ts-best-practices.md).
- Follow [Web rules](apps/web/AGENTS.md) for bilingual, accessible UI. Keep copy that helps users act or understand an outcome. Omit decorative labels and repeated instructions. Product artwork can carry concise selling points. Tie all claims to actual capabilities and keep fixtures distinct from real results.
- Use the sibling `gen-image` CLI (`../gen-image/generate.mjs` and its local `.env`) for all contributor AI images and reference-based edits. Report a blocker if unavailable. In-app generation follows the runtime rules.

## Runtime and data

- Production uses React/Vite on Workers Static Assets, Hono API Worker, separate image Queue/Cron Worker, private R2 and PostgreSQL via Hyperdrive. Node is isolated local development. No retired adapters, Redis/BullMQ or Workers video generation.
- Validate unknown inputs and uploads server-side. Scope all business reads and writes to the authenticated owner/workspace. Request IDs or storage keys do not establish ownership. Cookie auth requires trusted origins and CSRF protection. No wildcard credentialed CORS.
- Keep secrets and server imports out of Web and contracts. `VITE_*` is public. Use request/task IDs and sanitized errors. Never log prompts, uploads, cookies, provider responses, credentials or signed URLs.
- Paid generation uses authorization, durable task and outbox in one transaction, separate queue processing, reconciliation, storage and billing. Bound external calls with timeouts, cancellation and idempotent retries. Reconcile ambiguous submissions without auto-resubmitting. Explicitly confirmed replacement records the old outcome and actor, refunds the old attempt and charges the new attempt atomically. Reject stale results and duplicate charges.
- Keep routes thin, business logic in services and persistence in repositories. Avoid `any`, unchecked casts and hidden global clients. [Wrap JSON once](docs/node-ts-best-practices.md#api-响应) while retaining statuses and binary responses. Close local pools on shutdown and invocation-scoped Hyperdrive clients at completion. Disable business query caching and keep network calls outside DB transactions. Use append-only merged migrations, expand/contract and compatible deployments. Never auto-push schema.

## Git and verification

- Follow [release rules](docs/releasing.md#合并). Use dev by default and honor a user-requested branch. Preserve main/dev, unrelated worktrees and local changes. Fetch with pruning and fast-forward when authorized. Never reset to sync, amend existing commits, overwrite work or force-push shared branches. New branches/worktrees and parallel agents require a user request, with disjoint ownership and one integrator.
- Stage exact paths and commit one concern with an English imperative Conventional Commit and configured scope. Push, PR, merge, tags and deployment require explicit authorization. Feature PRs target dev, releases go dev → main. Honor protections and CI, fast-forward safely after an authorized merge and delete only requested, verified temporary branches. Shared contracts, migrations, lockfile and design tokens need one owner and explicit PR review.
- Run `pnpm check` and `git diff --check` for code, or `pnpm docs:check`, rule review and `git diff --check` for docs alone. Follow [quality rules](docs/code-quality.md) and [isolated testing](docs/testing.md). Never move the comment `ruleStartCommit` or add suppressions/baselines without approval. Use `pnpm quality:update` only to shrink the baseline. Keep automatic Quality and Infrastructure checks. Browser E2E runs only in manual GitHub Actions under `.github/ci/browser`. Local UI verification uses visual inspection and non-browser checks. Keep tests away from production, bonko, shared volumes and paid models.
- Use `pnpm ai:context` for read-only Git metadata. Report actual checks, unresolved items and authorization limits. Update the affected documentation in place.

## Header progress

Work through this list before resuming landing-page design. Mark an entry complete when its destination and behavior have been checked.

- [ ] Verify Start Creating, Workspace and Free Canvas.
- [x] Verify the landing menu's Hero Images link opens Main Image on desktop and mobile.
- [ ] Verify Image Set Planner, Textile Variations and Style Match.
- [ ] Audit Image Types, Features, Workflow and Resources for missing or duplicate destinations.
- [ ] Verify the menu in both languages and on desktop and mobile.
- [ ] Validate upload, generation, results, download and failure recovery for each tool in the appropriate test environment.
