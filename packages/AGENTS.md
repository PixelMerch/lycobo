# Shared package rules

Root AGENTS.md applies. Read docs/node-ts-best-practices.md before implementation;
use PROJECT_STRUCTURE.md for the relevant domain and existing public exports.
Packages never depend on apps. Keep contracts browser-safe; no server modules or secrets.
Use existing package exports between packages/apps and concrete imports within a package;
do not create per-directory barrels, generic helpers or new abstraction layers for tiny functions.
Tests stay next to implementations. A change to a shared contract requires caller review,
cross-deployment compatibility and coordination before implementation.
Database/SQL changes also require db/AGENTS.md and the PostgreSQL skill, even when made here.
Storage/provider/queue work must preserve ownership, paid-request idempotency and bounded retries.
Production uses Cloudflare bindings; Sharp/S3 and Node implementations remain isolated local tools.
