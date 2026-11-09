# API rules

Root AGENTS.md applies. Read docs/node-ts-best-practices.md and the relevant feature document
from docs/ai-workflow.md; DESIGN.md is needed only when the task affects UI behavior or appearance.
Keep createApp separate from the listening server for tests.
Use Hono app.request tests for request validation, ownership and error behavior.
No network effects at import time. No production fixture success endpoints.
Add authenticated feature routers under /api/v1; preserve shared contracts and request IDs.
A live process is not a ready database or worker; keep health semantics explicit.
For task, wallet or callback changes, trace the repository and consumer too; API success alone
does not verify submission, reconciliation, storage or billing. Read their directory rules.
