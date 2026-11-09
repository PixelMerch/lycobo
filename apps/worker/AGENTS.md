# Worker rules

Root AGENTS.md applies. Workers run independently of the API process.
Read docs/node-ts-best-practices.md and relevant task/storage/realtime documents through
docs/ai-workflow.md. Review shared repositories and contracts before changing the lifecycle.
Validate persisted job payloads. Jobs contain identifiers, not secrets or uploaded binary data.
Keep diagnostics separate from generation queues. Unsupported jobs fail, never silently succeed.
Graceful shutdown drains bounded work; unknown provider outcomes require reconciliation.
For Queue or persistence changes run isolated integration checks; Workers binding/DO behavior
also needs relevant platform checks from docs/testing.md. Do not invoke paid providers to test.
