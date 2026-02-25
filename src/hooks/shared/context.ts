import { resolveProjectId } from "../../memory/project-id";
import { resolveMemoryDbPath } from "../../memory/db-path";
import { SqliteMemoryStore } from "../../memory/store";
import { Logger } from "./logger";
import type { HookInputBase, MemoryEnvConfig } from "./types";

export interface HookRuntimeContext {
  config: MemoryEnvConfig;
  logger: Logger;
  store: SqliteMemoryStore;
  projectId: string;
}

export function createHookRuntimeContext(
  config: MemoryEnvConfig,
  input: HookInputBase
): HookRuntimeContext {
  const logger = new Logger(config.logLevel);
  const cwd = input.cwd ?? process.cwd();

  const projectId = resolveProjectId({
    cwd,
    mode: config.projectMode,
    manualProjectId: config.projectId
  });

  const store = new SqliteMemoryStore(resolveMemoryDbPath(config.dbPath, cwd));

  return {
    config,
    logger,
    store,
    projectId
  };
}
