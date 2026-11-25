# Database rules

Root and packages/AGENTS.md apply. Read docs/node-ts-best-practices.md and relevant domain docs
through docs/README.md; include callers/consumers when changing persistence behavior.
Read the PostgreSQL skill before modifying schema, SQL or migrations.
Use plural snake_case table names, with media_ for assets, generation_ for shared generation and image_ for image-specific edits. Keep media type separate from reference/output role. Video uses the shared generation and asset tables with a dedicated outbox. Audio is reserved. Existing diagnostic tasks and organization wallet ledgers remain separate.
Every business object is owner-scoped. Composite foreign keys preserve project/task ownership.
Use timezone-aware UTC timestamps, UUID public IDs and indexes for actual access paths.
Merged migrations are immutable. Coordinate migration ordering when working on parallel branches.
Database credentials must be explicit; local integration uses only dedicated disposable test data.
