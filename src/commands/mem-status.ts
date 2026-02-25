import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { resolveProjectId } from "../memory/project-id";
import { SqliteMemoryStore } from "../memory/store";

function formatStatusText(payload: {
  projectId: string;
  dbPath: string;
  totalMemories: number;
  lastWriteTs: string | null;
  topTags: Array<{ tag: string; count: number }>;
}): string {
  const lines = [
    `Project ID: ${payload.projectId}`,
    `Database: ${payload.dbPath}`,
    `Total memories: ${payload.totalMemories}`,
    `Last write: ${payload.lastWriteTs ?? "never"}`,
    "Top tags:"
  ];

  if (payload.topTags.length === 0) {
    lines.push("- (none)");
  } else {
    for (const tag of payload.topTags) {
      lines.push(`- ${tag.tag} (${tag.count})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function main(): void {
  const jsonOutput = process.argv.includes("--json");
  const config = getMemoryEnvConfig();
  const cwd = process.cwd();

  const projectId = resolveProjectId({
    cwd,
    mode: config.projectMode,
    manualProjectId: config.projectId
  });

  const store = new SqliteMemoryStore(resolveMemoryDbPath(config.dbPath, cwd));

  try {
    const stats = store.stats(projectId);
    const payload = { projectId, ...stats };

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatStatusText(payload));
  } finally {
    store.close();
  }
}

main();
