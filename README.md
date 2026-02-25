# Gemini Memory Extension

Persistent local memory for Gemini CLI, with shared MCP access for Antigravity and other MCP clients.

## What it does

- Captures useful outcomes from completed turns.
- Retrieves and injects relevant prior memories before new responses.
- Stores everything locally in SQLite (FTS5 for fast search).
- Supports MCP tools so non-Gemini clients can use the same memory DB.

## Runtime flow

1. `SessionStart` injects baseline context.
2. `BeforeAgent` pulls top matches from SQLite and reranks.
3. `AfterAgent` writes one memory card for the turn.
4. `/mem:*` command prompts are ignored by `AfterAgent` to avoid self-noise.

Default storage is project-scoped by folder name:

```text
${HOME}/.gemini/gemini-mem/<repo-folder>/memory.db
```

Example:

```text
C:\Users\<user>\.gemini\gemini-mem\test\memory.db
```

## Codebase map

```text
src/
  hooks/      # AfterAgent, BeforeAgent, SessionStart entrypoints
  memory/     # schema, sqlite store, retrieval, dedupe, redaction, db-path
  gemini/     # summarizer/reranker prompts + JSON validators
  commands/   # mem-status, mem-search, mem-last, mem-prune
  mcp/        # MCP tools + stdio/HTTP servers + project GEMINI.md sync
  runtime/    # process and Gemini CLI adapters
  cli/        # db init/migration scripts
```

## Install and run

### For extension users (one-time install)

- Install or link the extension in Gemini CLI.
- Gemini executes hooks from the installed extension path under `~/.gemini/extensions/...`.
- You do **not** run `npm install` in every target project repository.

### For local development

```bash
npm install
npm run build
gemini extensions link .
gemini extensions list
```

If you change TypeScript source, rebuild before testing in Gemini:

```bash
npm run build
```

## Slash commands

Defined in `commands/mem/*.toml`:

- `/mem:status`
- `/mem:search <query>`
- `/mem:last [limit]`
- `/mem:prune [maxAgeDays] [importanceFloor]`

Local script equivalents:

```bash
npm run mem:status
npm run mem:status -- --json
npm run mem:search -- "query text"
npm run mem:last -- 5
npm run mem:last -- 5 --json
npm run mem:prune -- 30 2
```

Notes:

- `mem-status` and `mem-last` are human-readable by default, `--json` optional.
- `mem-search` and `mem-prune` return JSON.

## MCP server (Antigravity-ready)

MCP tools:

- `memory_status`
- `memory_get_context`
- `memory_search`
- `memory_save_observation`
- `memory_cite`
- `memory_end_session`

Transports:

- stdio: `npm run mcp:server`
- HTTP: `npm run mcp:http` (default `http://127.0.0.1:3303/mcp`)

HTTP env overrides:

- `MEM_MCP_HTTP_HOST`
- `MEM_MCP_HTTP_PORT`
- `MEM_MCP_HTTP_PATH`

Antigravity-style server URL:

```text
http://127.0.0.1:3303/mcp
```

Recommended Antigravity tool-use order:

1. Start task: `memory_get_context`
2. During task: `memory_save_observation` for important decisions/findings
3. End task: `memory_end_session`

## Automatic project `GEMINI.md` for MCP sessions

When `memory_end_session` includes `project_cwd`, this project writes or updates `<project>/GEMINI.md` by default with:

- MCP URL
- required memory tool flow
- latest session summary
- lightweight codebase snapshot (stacks/key files/top directories)

Disable globally:

```bash
MEM_MCP_DISABLE_PROJECT_GEMINI_MD=true
```

## Config

Gemini extension settings are defined in `gemini-extension.json` (for example `MEM_DB_PATH`, `MEM_MAX_INJECT`, timeouts, model, and project mode).

Hook contract:

- read JSON from stdin
- logs to stderr
- final JSON only on stdout
- fail-open (`{}` on error)

## Test and validation

```bash
npm run build
npm run test
npm run test:hooks
npm run test:mcp
npm run test:mcp-http
```

## Contributing

- See `CONTRIBUTING.md` for setup, checks, and invariants.
