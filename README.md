# Gemini Memory Extension

Gemini CLI extension that saves and retrieves project memory from local SQLite, with MCP tools that share the same memory DB.

Official Gemini docs this README follows:
- Writing extensions: https://geminicli.com/docs/extensions/writing-extensions/
- Releasing extensions: https://geminicli.com/docs/extensions/releasing/

## What You Get

- Hook-based memory capture (`AfterAgent`) and retrieval (`BeforeAgent`, `SessionStart`)
- Slash commands for memory inspection and cleanup
- Optional MCP server tools for external agents/clients
- Local per-project storage by default:

```text
${HOME}/.gemini/gemini-mem/<repo-folder>/memory.db
```

## Quick Start (Use This Extension)

```bash
npm install
npm run build
gemini extensions link .
gemini extensions list
```

Then restart Gemini CLI.

## Daily Dev Loop

1. Edit code.
2. Rebuild: `npm run build`
3. Test: `npm test`
4. Restart Gemini CLI to pick up changes.

## Project Layout

```text
src/
  hooks/      # SessionStart, BeforeAgent, AfterAgent
  memory/     # sqlite store, schema, retrieval, dedupe, redaction
  gemini/     # summarizer/reranker prompts + validators
  commands/   # mem-status, mem-search, mem-last, mem-prune
  mcp/        # stdio and HTTP MCP servers + tool handlers
  runtime/    # process and Gemini CLI adapters
  cli/        # db init/migration scripts
```

## Slash Commands

- `/mem:status`
- `/mem:search <query>`
- `/mem:last [limit]`
- `/mem:prune [maxAgeDays] [importanceFloor]`

Local equivalents:

```bash
npm run mem:status
npm run mem:status -- --json
npm run mem:search -- "query text"
npm run mem:last -- 5
npm run mem:last -- 5 --json
npm run mem:prune -- 30 2
```

## MCP Tools

MCP is decoupled from hook runtime in this extension build. Hook execution does not require MCP server discovery.

- `memory_status`
- `memory_get_context`
- `memory_search`
- `memory_save_observation`
- `memory_cite`
- `memory_end_session`

Run transports:

```bash
npm run mcp:server
npm run mcp:http
```

If you want Gemini CLI to auto-discover this MCP server, register it explicitly in your user/project Gemini MCP settings.

Default HTTP endpoint:

```text
http://127.0.0.1:3303/mcp
```

Recommended MCP usage order:

1. `memory_get_context`
2. `memory_save_observation`
3. `memory_end_session`

## Config

Settings are defined in `gemini-extension.json` (DB path, model, limits, timeouts, project mode, command override).

## Release Checklist (What To Do)

This repo already has workflows in `.github/workflows/` and release notes in `PUBLISHING.md`.

1. Update version in both files:
   - `package.json`
   - `gemini-extension.json`
2. Validate locally:
   - `npm run build`
   - `npm test`
3. Commit and tag:
   - `git tag vX.Y.Z`
   - `git push origin main --tags`
4. Let GitHub Actions create/publish the release artifacts.
5. Install test from users' perspective:
   - `gemini extensions install <repo-url>`
   - or `gemini extensions install <repo-url> --ref=vX.Y.Z`

For gallery discoverability (from official docs):

- Keep repository public.
- Add GitHub topic `gemini-cli-extension`.
- Keep `gemini-extension.json` at repository root.

## Verification Commands

```bash
npm run build
npm test
npm run test:hooks
npm run test:mcp
npm run test:mcp-http
```

## Contributing

See `CONTRIBUTING.md`.
