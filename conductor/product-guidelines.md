# Product Guidelines

- Keep hook behavior fail-open to avoid breaking user workflows.
- Keep injected context concise and relevant.
- Prioritize deterministic local operations; use model calls selectively.
- Treat secrets conservatively: redact before persistence/injection.
