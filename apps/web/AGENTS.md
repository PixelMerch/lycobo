# Web rules

Root AGENTS.md applies. Read DESIGN.md and the React skill before editing.
Use official HeroUI v3 APIs installed in package.json, not v2 examples.
Keep route pages in src/features and shared application shell in src/app.
Use concrete feature imports, route-level lazy loading and AbortSignal-aware requests.
All API paths are relative /api; never read private runtime environment values.
Uploads are local preview only until a server authorization flow exists.
