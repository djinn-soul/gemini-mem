"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../hooks/shared/env");
const db_path_1 = require("../memory/db-path");
const project_id_1 = require("../memory/project-id");
const store_1 = require("../memory/store");
function formatStatusText(payload) {
    const lines = [
        `Project ID: ${payload.projectId}`,
        `Database: ${payload.dbPath}`,
        `Total memories: ${payload.totalMemories}`,
        `Last write: ${payload.lastWriteTs ?? "never"}`,
        "Top tags:"
    ];
    if (payload.topTags.length === 0) {
        lines.push("- (none)");
    }
    else {
        for (const tag of payload.topTags) {
            lines.push(`- ${tag.tag} (${tag.count})`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function main() {
    const jsonOutput = process.argv.includes("--json");
    const config = (0, env_1.getMemoryEnvConfig)();
    const cwd = process.cwd();
    const projectId = (0, project_id_1.resolveProjectId)({
        cwd,
        mode: config.projectMode,
        manualProjectId: config.projectId
    });
    const store = new store_1.SqliteMemoryStore((0, db_path_1.resolveMemoryDbPath)(config.dbPath, cwd));
    try {
        const stats = store.stats(projectId);
        const payload = { projectId, ...stats };
        if (jsonOutput) {
            process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
            return;
        }
        process.stdout.write(formatStatusText(payload));
    }
    finally {
        store.close();
    }
}
main();
