# MEMORIES

## Current state
- Extension manifest: `gemini-extension.json`
- Hook config: `hooks/hooks.json`
- Core memory logic: `src/memory/*`
- Hook entrypoints: `src/hooks/*.ts`

## Decisions
- TypeScript/Node runtime first, Bun later via runtime adapter swap.

## Conventions
- Hook stdout must be JSON-only.
- Hook logs go to stderr.
- Fail-open on hook failures.

## Gotchas
- Do not invoke Gemini subprocess without `GEMINI_MEM_INTERNAL=1` guard.

## Open questions / TODO
- Validate custom slash command packaging semantics for extension distribution.
