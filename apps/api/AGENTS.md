# API rules

Root AGENTS.md applies. Keep createApp separate from the listening server for tests.
Use Hono app.request tests for request validation, ownership and error behavior.
No network effects at import time. No production fixture success endpoints.
Add authenticated feature routers under /api/v1; preserve shared contracts and request IDs.
A live process is not a ready database or worker; keep health semantics explicit.
