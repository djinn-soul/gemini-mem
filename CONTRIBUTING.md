# Contributing

## Scope

This repo is a Gemini CLI memory extension with MCP access. Keep changes modular and preserve current hook/MCP contracts.

## Prerequisites

- Node.js 22+ (uses `node:sqlite`)
- npm
- Gemini CLI (for extension smoke tests)

## Local setup

```bash
npm install
npm run build
gemini extensions link .
```

## Development workflow

1. Edit `src/*` files only.
2. Keep code files under 300 LOC by splitting modules early.
3. Rebuild after source changes:
   - `npm run build`
4. Run tests:
   - `npm run test`
5. Smoke test from a target project:
   - `/mem:status`
   - `/mem:last`
   - optional MCP HTTP test with `npm run mcp:http`

## Required checks before PR

- `npm run build` passes.
- `npm run test` passes.
- Updated docs when behavior/config/commands changed.
- If extension runtime files changed, commit refreshed `dist/*` outputs.

## Hook and MCP invariants

- Hooks must read JSON from stdin.
- Hooks must write logs to stderr.
- Hooks must write only final JSON to stdout.
- Hooks must fail-open (return `{}` on errors).
- MCP tool names and request/response shapes must stay backward compatible unless intentionally versioned.

## Project storage rules

- Default DB path is per repo folder:
  - `${HOME}/.gemini/gemini-mem/<repo-folder>/memory.db`
- `MEM_DB_PATH` can be:
  - directory root (project DBs created under it), or
  - explicit sqlite file path (`.db`, `.sqlite`, `.sqlite3`)

## Release notes

For releases, keep extension metadata aligned:

- `package.json` `version`
- `gemini-extension.json` `version`

MCP server version is derived from `package.json`, so avoid hardcoded version constants.
