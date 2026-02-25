# GEMINI.md

Use this extension as persistent memory for project-level coding context.

## Memory behavior

- Memory cards are generated from completed agent turns.
- Retrieval combines local FTS shortlist and Gemini reranking.
- Injected context is concise and biasing toward decisions, constraints, and active tasks.

## Operator notes

- Keep memory cards technical and concrete.
- Avoid storing secrets; redaction is enforced before persistence.
- Use `npm run mem:status` to inspect health quickly.
