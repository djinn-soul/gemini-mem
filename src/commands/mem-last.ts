import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { resolveProjectId } from "../memory/project-id";
import { SqliteMemoryStore } from "../memory/store";

function parseArgs(): { limit: number; jsonOutput: boolean } {
  const args = process.argv.slice(2);
  let limit = 5;
  let jsonOutput = false;
  let limitSeen = false;

  for (const arg of args) {
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }

    if (limitSeen) {
      throw new Error("Usage: mem-last [limit>0] [--json]");
    }

    const parsed = Number.parseInt(arg, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Usage: mem-last [limit>0] [--json]");
    }

    limit = parsed;
    limitSeen = true;
  }

  return { limit, jsonOutput };
}

function formatMemoriesText(items: Array<{
  id: string;
  ts: string;
  type: string;
  title: string;
  summary: string;
  importance: number;
  tags: string[];
}>): string {
  if (items.length === 0) {
    return "No memories found for this project.\n";
  }

  const lines: string[] = [`Latest memories (${items.length}):`];

  for (const [index, item] of items.entries()) {
    const tags = item.tags.length > 0 ? item.tags.join(", ") : "none";
    lines.push(
      "",
      `${index + 1}. ${item.title}`,
      `   type: ${item.type} | importance: ${item.importance} | ts: ${item.ts}`,
      `   tags: ${tags}`,
      `   summary: ${item.summary}`
    );
  }

  return `${lines.join("\n")}\n`;
}

function main(): void {
  const { limit, jsonOutput } = parseArgs();

  const config = getMemoryEnvConfig();
  const cwd = process.cwd();
  const projectId = resolveProjectId({
    cwd,
    mode: config.projectMode,
    manualProjectId: config.projectId
  });

  const store = new SqliteMemoryStore(resolveMemoryDbPath(config.dbPath, cwd));

  try {
    const items = store.getLastMemories(projectId, limit);
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatMemoriesText(items));
  } finally {
    store.close();
  }
}

main();
