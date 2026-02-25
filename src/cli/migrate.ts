import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { SqliteMemoryStore } from "../memory/store";

function main(): void {
  const config = getMemoryEnvConfig();
  const dbPath = resolveMemoryDbPath(config.dbPath, process.cwd());
  const store = new SqliteMemoryStore(dbPath);

  store.close();
  process.stdout.write(`Migrations are up-to-date for ${dbPath}\n`);
}

main();
