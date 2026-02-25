import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { resolveProjectId } from "../memory/project-id";
import { SqliteMemoryStore } from "../memory/store";

function main(): void {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    throw new Error("Usage: mem-search <query>");
  }

  const config = getMemoryEnvConfig();
  const cwd = process.cwd();
  const projectId = resolveProjectId({
    cwd,
    mode: config.projectMode,
    manualProjectId: config.projectId
  });

  const store = new SqliteMemoryStore(resolveMemoryDbPath(config.dbPath, cwd));

  try {
    const matches = store.searchCandidates(projectId, query, config.rerankCandidates);
    process.stdout.write(`${JSON.stringify(matches, null, 2)}\n`);
  } finally {
    store.close();
  }
}

main();
