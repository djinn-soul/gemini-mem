# PLANS

## Purpose / Big Picture
Ship a TypeScript/Node Gemini memory extension with Bun-ready module boundaries.

## Progress
- [x] 2026-02-25 scaffolded extension layout and hook wiring
- [x] 2026-02-25 implemented SQLite memory store + retrieval core
- [x] 2026-02-25 implemented `AfterAgent`, `BeforeAgent`, `SessionStart` hooks
- [x] 2026-02-25 added memory diagnostics command scripts
- [x] 2026-02-25 added extension slash command TOML files under `commands/mem/*.toml`
- [x] 2026-02-25 added deterministic integration harness (`tests/hooks.integration.test.cjs`)
- [x] 2026-02-25 added fail-open integration test for `AfterAgent` Gemini subprocess failures
- [x] 2026-02-25 completed live linked-extension smoke checks (`/mem:status`, `/mem:search`)
- [x] 2026-02-25 debugged and fixed live `AfterAgent` capture failures on Windows
- [x] 2026-02-25 switched default DB layout to per-repo paths (`~/.gemini/gemini-mem/<repo>/memory.db`)
- [x] 2026-02-25 removed runtime npm dependency and prepared repo to ship prebuilt `dist/` for install-once behavior
- [x] 2026-02-25 tightened `/mem:*` command prompts to return only JSON and suppress Node SQLite warnings
- [x] 2026-02-25 switched `mem-status` and `mem-last` to readable default output with optional `--json`
- [x] 2026-02-25 prevented `AfterAgent` writes for `/mem:*` command turns and added regression test
- [x] 2026-02-25 added MCP server v1 with memory tools and extension manifest registration
- [x] 2026-02-25 added MCP integration tests and combined test script (`test:hooks` + `test:mcp`)
- [x] 2026-02-25 added MCP HTTP server for host/port clients and HTTP integration tests
- [x] 2026-02-25 centralized MCP constants and wired server version to package metadata
- [x] 2026-02-25 added Antigravity-only auto project `GEMINI.md` sync on `memory_end_session`
- [x] 2026-02-25 switched project `GEMINI.md` sync to default-on and added codebase snapshot generation

## Surprises & Discoveries
- Hook wiring is configured via `hooks/hooks.json`, not directly in `gemini-extension.json`.
- `gemini -y -p` command runs include noisy `AttachConsole failed` logs from non-project extension hooks (maestro), while command outputs still succeed.
- Root causes for missing live memory writes were `spawn gemini ENOENT` in hook subprocesses and host-level hook timeout defaults.

## Decision Log
- 2026-02-25: keep model calls isolated in `src/runtime/gemini-cli.ts` for Bun migration.

## Outcomes & Retrospective
- End-to-end scaffold is complete from empty repository.

## Validation and Acceptance
- `npm run test:hooks` passed (includes build + 5 integration tests).
- `npm run test:mcp` passed (3 integration tests).
- `npm run test:mcp-http` passed (2 integration tests).
- `npm run test` passed (hooks + MCP stdio + MCP HTTP suites).
- `npm run test:mcp` now passes 4 integration tests including Antigravity context-file sync.
- `npm run test` passes after default-on project `GEMINI.md` generation update.
- `gemini extensions link . --consent` and `gemini extensions list` confirmed live extension load.
- `gemini --debug -y -p "Reply exactly with: ack-debug"` confirmed successful `AfterAgent` execution, and persisted memories are visible via `npm run --silent mem:last -- 10`.
