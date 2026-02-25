import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { resolveProjectId } from "../memory/project-id";
import { SqliteMemoryStore } from "../memory/store";

function main(): void {
  const maxAgeDaysArg = process.argv[2];
  const importanceArg = process.argv[3];

  const maxAgeDays = maxAgeDaysArg ? Number.parseInt(maxAgeDaysArg, 10) : 30;
  const importanceFloor = importanceArg ? Number.parseInt(importanceArg, 10) : 2;

  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error("Usage: mem-prune [maxAgeDays>0] [importanceFloor>=1]");
  }

  if (!Number.isFinite(importanceFloor) || importanceFloor < 1) {
    throw new Error("Usage: mem-prune [maxAgeDays>0] [importanceFloor>=1]");
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
    const deleted = store.pruneMemories(projectId, maxAgeDays, importanceFloor);
    process.stdout.write(`${JSON.stringify({ deleted, maxAgeDays, importanceFloor }, null, 2)}\n`);
  } finally {
    store.close();
  }
}

main();
