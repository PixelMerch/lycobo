# Worker rules

Root AGENTS.md applies. Workers run independently of the API process.
Validate persisted job payloads. Jobs contain identifiers, not secrets or uploaded binary data.
Keep diagnostics separate from generation queues. Unsupported jobs fail, never silently succeed.
Graceful shutdown drains bounded work; unknown provider outcomes require reconciliation.
