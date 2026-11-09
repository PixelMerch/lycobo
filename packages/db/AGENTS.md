# Database rules

Root and packages/AGENTS.md apply. Read docs/node-ts-best-practices.md and relevant domain docs
through docs/ai-workflow.md; include callers/consumers when changing persistence behavior.
Read the PostgreSQL skill before modifying schema, SQL or migrations.
Every business object is owner-scoped. Composite foreign keys preserve project/task ownership.
Use timezone-aware UTC timestamps, UUID public IDs and indexes for actual access paths.
Merged migrations are immutable. Coordinate migration ordering when working on parallel branches.
Database credentials must be explicit; local integration uses only dedicated disposable test data.
